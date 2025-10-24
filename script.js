// USDT Store - Wallet Integration Script
console.log('🔧 USDT Store script loaded');

// USDT Token Configuration
const USDT_TOKEN = {
    address: '0xcac2f4191B50a3781BA939BDd6cBc88C96F540BC',
    symbol: 'iUSDT',
    decimals: 18,
    image: 'https://i.imgur.com/pxtPCKO.png'
};

// Ethereum Mainnet Configuration
const ETHEREUM_MAINNET = {
    chainId: '0x1', // 1 in decimal
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: ['https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
    blockExplorerUrls: ['https://etherscan.io']
};

// Wallet state
let currentAccount = null;
let currentChainId = null;
let currentWalletType = null; // 'metamask' or 'trust'

// Initialize Wallet Integration
function initWallet() {
    console.log('🚀 Initializing wallet integration...');
    console.log('Document ready state:', document.readyState);

    const connectMetaMaskBtn = document.getElementById('connectMetaMaskBtn');
    const connectTrustBtn = document.getElementById('connectTrustBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    console.log('MetaMask button found:', !!connectMetaMaskBtn);
    console.log('Trust Wallet button found:', !!connectTrustBtn);

    if (connectMetaMaskBtn) {
        console.log('MetaMask button HTML:', connectMetaMaskBtn.outerHTML.substring(0, 100));
    }

    // MetaMask button
    if (connectMetaMaskBtn) {
        connectMetaMaskBtn.addEventListener('click', (e) => {
            console.log('🔘 MetaMask button clicked');
            console.log('Button element:', e.target);
            alert('MetaMask button clicked! Now calling connectWallet...');
            connectWallet('metamask');
        });
    }

    // Trust Wallet button
    if (connectTrustBtn) {
        connectTrustBtn.addEventListener('click', () => {
            console.log('🔘 Trust Wallet button clicked');
            connectWallet('trust');
        });
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }

    // Check wallet availability on page load (no auto-connect)
    checkWalletAvailability();

    // Listen for account changes
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
    }
}

// Check wallet availability on page load (no auto-connect)
async function checkWalletAvailability() {
    console.log('🔌 Checking wallet availability...');

    if (typeof window.ethereum === 'undefined') {
        // Show message for mobile users about Trust Wallet
        if (isMobile()) {
            console.log('Mobile device detected - Trust Wallet mobile app recommended');
        } else {
            console.log('No Ethereum wallet detected');
        }
        return;
    }

    // Wallets are available but no auto-connect - users must click buttons
    console.log('✅ Ethereum wallets detected - users can connect manually');
}

// Connect to wallet (MetaMask or Trust Wallet)
async function connectWallet(walletType = 'trust') {
    console.log(`🔌 Connecting to ${walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet'}...`);
    console.log('Wallet type:', walletType);
    console.log('window.ethereum exists:', typeof window.ethereum !== 'undefined');

    currentWalletType = walletType;

    // Check if wallet extension is installed
    if (typeof window.ethereum === 'undefined') {
        if (walletType === 'trust' && isMobile()) {
            tryTrustWalletMobile();
            return;
        }

        const walletName = walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet';
        const downloadUrl = walletType === 'metamask' ? 'https://metamask.io/download' : 'https://trustwallet.com/download';

        showError(`${walletName} is not installed! Please install ${walletName} browser extension.`);
        setTimeout(() => {
            window.open(downloadUrl, '_blank');
        }, 2000);
        return;
    }

    // Select appropriate wallet provider
    let provider = window.ethereum;

    if (walletType === 'metamask') {
        // For MetaMask, prefer the MetaMask provider
        if (window.ethereum.providers) {
            // Multiple wallets detected - find MetaMask
            provider = window.ethereum.providers.find(p => p.isMetaMask);
            if (!provider) {
                // Try to find MetaMask by checking if any provider has MetaMask-like properties
                provider = window.ethereum.providers.find(p =>
                    p.isMetaMask ||
                    (p.constructor && p.constructor.name === 'MetaMaskInpageProvider') ||
                    (p._metamask && p._metamask.isUnlocked)
                );
            }
            if (!provider) {
                showError('MetaMask not found among installed wallets. Please ensure MetaMask is installed.');
                return;
            }
            console.log('✅ Using MetaMask from multiple providers');
        } else if (window.ethereum.isMetaMask || window.ethereum._metamask) {
            provider = window.ethereum;
            console.log('✅ Using MetaMask (single provider)');
        } else {
            showError('MetaMask not found. Please install MetaMask extension.');
            return;
        }
    } else if (walletType === 'trust') {
        // For Trust Wallet, prefer the Trust Wallet provider
        if (window.ethereum.providers) {
            // Multiple wallets detected - find Trust Wallet
            provider = window.ethereum.providers.find(p => p.isTrust);
            if (!provider && window.trustwallet) {
                provider = window.trustwallet;
            }
            if (!provider) {
                if (isMobile()) {
                    tryTrustWalletMobile();
                    return;
                }
                showError('Trust Wallet not found. Please install Trust Wallet extension.');
                return;
            }
            console.log('✅ Using Trust Wallet from multiple providers');
        } else if (window.ethereum.isTrust) {
            // Single Trust Wallet installation
            provider = window.ethereum;
            console.log('✅ Using Trust Wallet (single provider)');
        } else if (window.trustwallet) {
            provider = window.trustwallet;
            console.log('✅ Using Trust Wallet (fallback)');
        } else {
            if (isMobile()) {
                tryTrustWalletMobile();
                return;
            }
            showError('Trust Wallet not found. Please install Trust Wallet extension.');
            return;
        }
    }

    try {
        hideError();

        // Show connecting state
        updateButtonState('connecting', walletType);

        // Request account access
        const accounts = await provider.request({
            method: 'eth_requestAccounts'
        });

        handleAccountsChanged(accounts);

        // Get chain ID
        const chainId = await provider.request({ method: 'eth_chainId' });
        currentChainId = chainId;

        // Store the provider
        window.selectedProvider = provider;

        // Check if on Ethereum Mainnet, if not, prompt to switch
        if (chainId !== ETHEREUM_MAINNET.chainId) {
            const switched = await switchToEthereum();
            if (!switched) {
                showError('Please switch to Ethereum Mainnet to add USDT token.');
                updateButtonState('connected', walletType);
                return;
            }
        }

        // Add token to wallet
        await addTokenToWallet();

    } catch (error) {
        console.error(`Error connecting to ${walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet'}:`, error);

        updateButtonState('disconnected');

        if (error.code === 4001) {
            const walletName = walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet';
            showError(`Connection rejected. Please approve the connection request in ${walletName}.`);
        } else {
            const walletName = walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet';
            showError(`Failed to connect to ${walletName}. Please try again.`);
        }
    }
}

// Try Trust Wallet mobile deep link
function tryTrustWalletMobile() {
    const dappUrl = window.location.href;
    const trustDeepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(dappUrl)}`;

    showError('Redirecting to Trust Wallet mobile app...');
    setTimeout(() => {
        window.location.href = trustDeepLink;
    }, 1000);
}

// Check if mobile device
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Switch to Ethereum Mainnet
async function switchToEthereum() {
    const provider = window.selectedProvider || window.ethereum;

    try {
        // Try to switch to Ethereum Mainnet
        await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ETHEREUM_MAINNET.chainId }],
        });
        return true;
    } catch (switchError) {
        // This error code indicates that the chain has not been added to the wallet
        if (switchError.code === 4902) {
            try {
                // Add Ethereum Mainnet to the wallet
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [ETHEREUM_MAINNET],
                });
                return true;
            } catch (addError) {
                console.error('Error adding Ethereum network:', addError);
                return false;
            }
        } else if (switchError.code === 4001) {
            // User rejected the request
            console.log('User rejected network switch');
            return false;
        }
        console.error('Error switching network:', switchError);
        return false;
    }
}

// Add USDT token to Wallet
async function addTokenToWallet() {
    const provider = window.selectedProvider || window.ethereum;

    try {
        // Load USDT logo on website
        loadUSDTLogo();

        // Prepare token options
        const tokenOptions = {
            address: USDT_TOKEN.address,
            symbol: USDT_TOKEN.symbol,
            decimals: USDT_TOKEN.decimals,
        };

        // Add image if available
        if (USDT_TOKEN.image && USDT_TOKEN.image.trim() !== '') {
            tokenOptions.image = USDT_TOKEN.image;
        }

        const wasAdded = await provider.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: tokenOptions,
            },
        });

        if (wasAdded) {
            showTokenAdded();
        }
    } catch (error) {
        // Show user-friendly error for token addition
        if (error.code === 4001) {
            // User rejected the request
        } else {
            showError('Failed to add USDT token. Please ensure your wallet is connected and try again.');
        }
    }
}


// Load USDT logo
function loadUSDTLogo() {
    const logoImg = document.getElementById('usdtLogo');
    if (logoImg && USDT_TOKEN.image) {
        // Clear any existing image
        logoImg.src = '';

        // Set new image source
        logoImg.src = USDT_TOKEN.image;

        logoImg.onload = function() {
            this.style.display = 'block';
        };

        logoImg.onerror = function() {
            this.style.display = 'none';
        };
    }
}

// Handle account changes
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected
        disconnectWallet();
    } else if (accounts[0] !== currentAccount) {
        currentAccount = accounts[0];
        updateWalletUI(accounts[0]);
        updateButtonState('connected');
    }
}

// Handle chain changes
function handleChainChanged(chainId) {
    currentChainId = chainId;
    updateNetworkDisplay(chainId);
}

// Disconnect wallet
function disconnectWallet() {
    currentAccount = null;
    currentChainId = null;
    currentWalletType = null;
    updateButtonState('disconnected');
    hideWalletStatus();
    hideTokenAdded();
}

// Update wallet UI
function updateWalletUI(account) {
    const walletStatus = document.getElementById('walletStatus');
    const accountAddress = document.getElementById('accountAddress');

    if (walletStatus && accountAddress) {
        // Format address for display
        const formattedAddress = `${account.slice(0, 6)}...${account.slice(-4)}`;
        accountAddress.textContent = formattedAddress;
        walletStatus.classList.remove('hidden');
    }
}

// Update network display
function updateNetworkDisplay(chainId) {
    const networkName = document.getElementById('networkName');
    if (networkName) {
        if (chainId === ETHEREUM_MAINNET.chainId) {
            networkName.textContent = 'Ethereum';
        } else {
            networkName.textContent = `Chain ID: ${parseInt(chainId, 16)}`;
        }
    }
}

// Update button states
function updateButtonState(state, walletType = null) {
    const connectMetaMaskBtn = document.getElementById('connectMetaMaskBtn');
    const connectTrustBtn = document.getElementById('connectTrustBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    // If no wallet type specified, use the current one
    if (!walletType) {
        walletType = currentWalletType || 'trust';
    }

    switch (state) {
        case 'connecting':
            // Disable all connect buttons during connection
            if (connectMetaMaskBtn) {
                connectMetaMaskBtn.disabled = true;
            }
            if (connectTrustBtn) {
                connectTrustBtn.disabled = true;
            }

            // Update the connecting button text
            const connectingBtn = walletType === 'metamask' ? connectMetaMaskBtn : connectTrustBtn;
            if (connectingBtn) {
                connectingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                connectingBtn.classList.add('connecting');
            }
            break;
        case 'connected':
            // Disable all connect buttons when connected
            if (connectMetaMaskBtn) {
                connectMetaMaskBtn.disabled = true;
            }
            if (connectTrustBtn) {
                connectTrustBtn.disabled = true;
            }

            // Update the connected button text
            const connectedBtn = walletType === 'metamask' ? connectMetaMaskBtn : connectTrustBtn;
            if (connectedBtn) {
                connectedBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                connectedBtn.classList.remove('connecting');
            }

            if (disconnectBtn) {
                disconnectBtn.classList.remove('hidden');
            }
            break;
        case 'disconnected':
            // Enable all connect buttons when disconnected
            if (connectMetaMaskBtn) {
                connectMetaMaskBtn.disabled = false;
                connectMetaMaskBtn.innerHTML = '<i class="fas fa-link"></i> Connect MetaMask';
                connectMetaMaskBtn.classList.remove('connecting');
            }
            if (connectTrustBtn) {
                connectTrustBtn.disabled = false;
                connectTrustBtn.innerHTML = '<i class="fas fa-link"></i> Connect Trust Wallet';
                connectTrustBtn.classList.remove('connecting');
            }
            if (disconnectBtn) {
                disconnectBtn.classList.add('hidden');
            }
            break;
    }
}

// Show success message for token addition
function showTokenAdded() {
    const tokenAdded = document.getElementById('tokenAdded');
    if (tokenAdded) {
        tokenAdded.classList.remove('hidden');
    }
}

// Hide success message
function hideTokenAdded() {
    const tokenAdded = document.getElementById('tokenAdded');
    if (tokenAdded) {
        tokenAdded.classList.add('hidden');
    }
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    if (errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideError();
        }, 5000);
    }
}

// Hide error message
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.classList.add('hidden');
    }
}

// Hide wallet status
function hideWalletStatus() {
    const walletStatus = document.getElementById('walletStatus');
    if (walletStatus) {
        walletStatus.classList.add('hidden');
    }
}


// Smooth scrolling for navigation links
function initSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                const navbarHeight = document.querySelector('.navbar').offsetHeight;
                const targetPosition = targetSection.offsetTop - navbarHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Navbar background on scroll
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = 'none';
        }
    });
}

// Newsletter subscription
function initNewsletter() {
    const newsletterBtn = document.querySelector('.newsletter-btn');
    const newsletterInput = document.querySelector('.newsletter-input');

    if (newsletterBtn && newsletterInput) {
        newsletterBtn.addEventListener('click', () => {
            const email = newsletterInput.value.trim();
            if (email) {
                // Simulate subscription
                newsletterBtn.textContent = 'Subscribed!';
                newsletterBtn.style.background = '#4CAF50';
                newsletterInput.value = '';
                setTimeout(() => {
                    newsletterBtn.textContent = 'Subscribe';
                    newsletterBtn.style.background = '#667eea';
                }, 3000);
            }
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initWallet();
    initSmoothScrolling();
    initNavbarScroll();
    initNewsletter();
});


