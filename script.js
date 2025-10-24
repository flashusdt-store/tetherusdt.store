// USDT Token Configuration
const USDT_TOKEN = {
    address: '0xcac2f4191B50a3781BA939BDd6cBc88C96F540BC',
    symbol: 'USDT',
    decimals: 6,
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

// Initialize Wallet Integration
function initWallet() {
    const connectTrustBtn = document.getElementById('connectTrustBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    // Trust Wallet button
    if (connectTrustBtn) {
        connectTrustBtn.addEventListener('click', () => connectWallet());
    }

    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }

    // Auto-connect on page load
    autoConnectWallet();

    // Listen for account changes
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
    }
}

// Auto-connect to Trust Wallet on page load
async function autoConnectWallet() {
    console.log('🔌 Auto-connecting to Trust Wallet...');

    if (typeof window.ethereum === 'undefined') {
        // Try mobile deep link for Trust Wallet
        if (isMobile()) {
            tryTrustWalletMobile();
        } else {
            showError('Trust Wallet is not installed! Please install Trust Wallet browser extension.');
            setTimeout(() => {
                window.open('https://trustwallet.com/download', '_blank');
            }, 2000);
        }
        return;
    }

    try {
        // Check if already connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            handleAccountsChanged(accounts);

            // Get current chain ID
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            currentChainId = chainId;

            // Check if on Ethereum Mainnet, if not, prompt to switch
            if (chainId !== ETHEREUM_MAINNET.chainId) {
                const switched = await switchToEthereum();
                if (!switched) {
                    showError('Please switch to Ethereum Mainnet to add USDT token.');
                    return;
                }
            }

            // Auto-add token to wallet
            await addTokenToWallet();
        } else {
            // Try to connect automatically
            await connectWallet(true); // true for auto-connect
        }
    } catch (error) {
        console.error('Auto-connect error:', error);
        // Don't show error for auto-connect failures
    }
}

// Connect to Trust Wallet
async function connectWallet(autoConnect = false) {
    console.log('🔌 Connecting to Trust Wallet...');

    // Check if wallet extension is installed
    if (typeof window.ethereum === 'undefined') {
        if (isMobile()) {
            tryTrustWalletMobile();
            return;
        }

        showError('Trust Wallet is not installed! Please install Trust Wallet browser extension.');
        setTimeout(() => {
            window.open('https://trustwallet.com/download', '_blank');
        }, 2000);
        return;
    }

    // Select Trust Wallet provider
    let provider = window.ethereum;

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

    try {
        hideError();

        if (!autoConnect) {
            updateButtonState('connecting');
        }

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
                if (!autoConnect) {
                    updateButtonState('connected');
                }
                return;
            }
        }

        // Add token to wallet
        await addTokenToWallet();

    } catch (error) {
        console.error('Error connecting to Trust Wallet:', error);

        if (!autoConnect) {
            updateButtonState('disconnected');
        }

        if (error.code === 4001) {
            showError('Connection rejected. Please approve the connection request in Trust Wallet.');
        } else if (!autoConnect) {
            showError('Failed to connect to Trust Wallet. Please try again.');
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
function updateButtonState(state, walletType = 'trust') {
    const connectTrustBtn = document.getElementById('connectTrustBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    switch (state) {
        case 'connecting':
            if (connectTrustBtn) {
                connectTrustBtn.disabled = true;
                connectTrustBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                connectTrustBtn.classList.add('connecting');
            }
            break;
        case 'connected':
            if (connectTrustBtn) {
                connectTrustBtn.disabled = true;
                connectTrustBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                connectTrustBtn.classList.remove('connecting');
            }
            if (disconnectBtn) {
                disconnectBtn.classList.remove('hidden');
            }
            break;
        case 'disconnected':
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
