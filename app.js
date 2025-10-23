// USDT Store - TrustWallet Mobile & TronLink Support
// TRC20 USDT Contract Address
const USDT_CONTRACT = 'TH6dmHZ3iCrnceceGDYa4L8adUCDakLwpw';

// Token Information for Auto-Import
const TOKEN_INFO = {
    type: 'trc20',
    options: {
        address: USDT_CONTRACT,
        symbol: 'USDT',
        decimals: 6,
        image: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        name: 'Tether USD'
    }
};

// Application State
let walletConnected = false;
let userAddress = null;
let tronWeb = null;
let usdtContract = null;
let walletType = null; // 'tronlink', 'trustwallet', or 'trustwallet-mobile'

// DOM Elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletInfo = document.getElementById('walletInfo');
const walletAddressEl = document.getElementById('walletAddress');
const usdtBalanceEl = document.getElementById('usdtBalance');
const trxBalanceEl = document.getElementById('trxBalance');
const transactionForm = document.getElementById('transactionForm');
const instructionsCard = document.getElementById('instructionsCard');
const sendForm = document.getElementById('sendForm');
const toast = document.getElementById('toast');
const loadingOverlay = document.getElementById('loadingOverlay');
const copyAddressBtn = document.getElementById('copyAddress');
const copyContractBtn = document.getElementById('copyContract');
const availableBalanceEl = document.getElementById('availableBalance');

// TRC20 ABI (minimal for USDT operations)
const TRC20_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
];

// Initialize on page load
window.addEventListener('load', async () => {
    await detectWallet();
    setupEventListeners();
});

// Detect available wallet (TrustWallet or TronLink)
async function detectWallet() {
    let attempts = 0;
    const maxAttempts = 5;
    
    const checkWallet = async () => {
        attempts++;
        
        // Check for TrustWallet Mobile (DApp Browser)
        // TrustWallet mobile injects tronWeb directly when browsing TRON dApps
        if (isTrustWalletMobile()) {
            console.log('✅ TrustWallet Mobile detected!');
            walletType = 'trustwallet-mobile';
            
            // Wait a bit for tronWeb to be injected
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (window.tronWeb && window.tronWeb.ready) {
                tronWeb = window.tronWeb;
                showToast('✅ TrustWallet detected and ready! Click "Connect Wallet" to continue.', 'success');
                return true;
            } else if (window.tronWeb) {
                showToast('📱 TrustWallet detected! Click "Connect Wallet" to continue.', 'success');
                return true;
            }
        }
        
        // Check for TronLink (Browser Extension or Mobile)
        if (window.tronLink || window.tronWeb) {
            console.log('✅ TronLink detected!');
            walletType = 'tronlink';
            
            // Check if TronLink is ready (unlocked)
            if (window.tronWeb && window.tronWeb.ready) {
                tronWeb = window.tronWeb;
                showToast('✅ TronLink detected and ready! Click "Connect Wallet" to continue.', 'success');
                return true;
            } else {
                // TronLink is installed but locked
                showToast('🔒 TronLink detected but locked. Please unlock your wallet and click "Connect Wallet".', 'warning');
                return true;
            }
        }
        
        // Continue checking for a few seconds
        if (attempts < maxAttempts) {
            setTimeout(checkWallet, 1000);
        } else {
            // No wallet detected after 5 seconds
            showToast('⚠️ No wallet detected. Please install TronLink or use TrustWallet mobile app.', 'warning');
        }
        
        return false;
    };
    
    await checkWallet();
}

// Check if TrustWallet Mobile
function isTrustWalletMobile() {
    // TrustWallet mobile can be detected by checking user agent and injected objects
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isTrustUA = /Trust/i.test(userAgent);
    const hasTrustWallet = window.trustwallet !== undefined;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    return (isTrustUA || hasTrustWallet) && isMobile;
}

// Setup Event Listeners
function setupEventListeners() {
    connectWalletBtn.addEventListener('click', connectWallet);
    copyAddressBtn.addEventListener('click', () => copyToClipboard(userAddress, 'Address copied!'));
    copyContractBtn.addEventListener('click', () => copyToClipboard(USDT_CONTRACT, 'Contract address copied!'));
    sendForm.addEventListener('submit', handleSendTransaction);

    // Listen for account changes
    window.addEventListener('message', (e) => {
        if (e.data.message && (e.data.message.action === 'setAccount' || e.data.message.action === 'accountsChanged')) {
            console.log('Wallet account changed');
            if (walletConnected) {
                showToast('Wallet account changed. Reconnecting...', 'info');
                setTimeout(() => location.reload(), 1500);
            }
        }
    });
}

// Connect Wallet Function (Universal for TrustWallet & TronLink)
async function connectWallet() {
    try {
        showLoading(true);
        
        // TrustWallet Mobile (uses injected tronWeb directly)
        if (walletType === 'trustwallet-mobile') {
            await connectTrustWallet();
        }
        // TronLink (Browser Extension or Mobile)
        else if (walletType === 'tronlink') {
            await connectTronLink();
        }
        // Fallback: Try to detect what's available
        else {
            if (isTrustWalletMobile() && window.tronWeb) {
                walletType = 'trustwallet-mobile';
                await connectTrustWallet();
            } else if (window.tronLink || window.tronWeb) {
                walletType = 'tronlink';
                await connectTronLink();
            } else {
                throw new Error('No TRON wallet detected. Please use TrustWallet mobile app or install TronLink.');
            }
        }

    } catch (error) {
        console.error('Connection error:', error);
        handleConnectionError(error);
    } finally {
        showLoading(false);
    }
}

// Connect TrustWallet Mobile
async function connectTrustWallet() {
    try {
        console.log('📱 Connecting TrustWallet Mobile...');
        
        // TrustWallet mobile injects tronWeb directly
        if (!window.tronWeb) {
            throw new Error('TronWeb not found. Please make sure you are using TrustWallet mobile app DApp browser.');
        }

        // Wait for tronWeb to be ready
        let readyAttempts = 0;
        while (!window.tronWeb.ready && readyAttempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            readyAttempts++;
        }

        if (!window.tronWeb.ready) {
            throw new Error('Please unlock your TrustWallet and try again.');
        }

        tronWeb = window.tronWeb;
        
        // Get user address
        userAddress = tronWeb.defaultAddress.base58;
        
        if (!userAddress || userAddress === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb') {
            throw new Error('No wallet address found. Please unlock TrustWallet and try again.');
        }

        console.log('✅ TrustWallet connected:', userAddress);

        // Initialize USDT contract
        await initializeContract();

        // Auto-import USDT token
        await autoImportToken();

        // Update UI
        walletConnected = true;
        updateWalletUI('TrustWallet');
        
        // Fetch balances
        await updateBalances();

        showToast('✅ TrustWallet connected! USDT token imported.', 'success');
        
        // Hide instructions, show transaction form
        instructionsCard.style.display = 'none';
        transactionForm.style.display = 'block';

    } catch (error) {
        throw error;
    }
}

// Connect TronLink Wallet
async function connectTronLink() {
    try {
        console.log('🔗 Connecting TronLink...');
        
        // Check if TronLink exists
        if (!window.tronLink && !window.tronWeb) {
            throw new Error('TronLink not found. Please install TronLink extension or use TrustWallet mobile app.');
        }

        // Wait for TronLink to be ready
        if (!window.tronWeb || !window.tronWeb.ready) {
            // Request account access - this will prompt user to unlock
            showToast('🔓 Please unlock TronLink and approve the connection...', 'info');
            
            if (window.tronLink) {
                const res = await window.tronLink.request({ 
                    method: 'tron_requestAccounts' 
                });
                
                if (res.code === 200) {
                    // Wait a moment for TronWeb to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Check again
                    if (!window.tronWeb || !window.tronWeb.ready) {
                        throw new Error('Please unlock TronLink wallet and try again.');
                    }
                } else if (res.code === 4001) {
                    throw new Error('Connection request rejected. Please approve the connection in TronLink.');
                } else {
                    throw new Error('Failed to connect. Please make sure TronLink is unlocked.');
                }
            }
        }

        // At this point, TronWeb should be ready
        tronWeb = window.tronWeb;
        
        // Verify TronWeb is properly initialized
        if (!tronWeb || !tronWeb.defaultAddress || !tronWeb.defaultAddress.base58) {
            throw new Error('TronLink is not properly initialized. Please refresh the page and try again.');
        }

        userAddress = tronWeb.defaultAddress.base58;
        
        if (!userAddress || userAddress === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb') {
            throw new Error('No wallet address found. Please unlock TronLink and try again.');
        }

        console.log('✅ TronLink connected:', userAddress);

        // Initialize USDT contract
        await initializeContract();

        // Auto-import USDT token
        await autoImportToken();

        // Update UI
        walletConnected = true;
        updateWalletUI('TronLink');
        
        // Fetch balances
        await updateBalances();

        showToast('✅ TronLink connected! USDT token imported.', 'success');
        
        // Hide instructions, show transaction form
        instructionsCard.style.display = 'none';
        transactionForm.style.display = 'block';

    } catch (error) {
        throw error;
    }
}

// Auto-import USDT Token to Wallet
async function autoImportToken() {
    try {
        console.log('🪙 Attempting to auto-import USDT token...');
        
        // For TronLink - use wallet_watchAsset
        if (walletType === 'tronlink' && window.tronLink) {
            try {
                const result = await window.tronLink.request({
                    method: 'wallet_watchAsset',
                    params: {
                        type: 'trc20',
                        options: {
                            address: USDT_CONTRACT,
                            symbol: 'USDT',
                            decimals: 6,
                            image: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
                        }
                    }
                });
                
                if (result) {
                    console.log('✅ USDT token imported via TronLink');
                    showToast('✅ USDT token added to your wallet!', 'success');
                }
            } catch (tokenError) {
                console.log('Token auto-import (TronLink):', tokenError.message || 'Token may already exist');
            }
        }
        
        // For TrustWallet Mobile - token should be visible automatically
        // TrustWallet shows all TRC20 tokens by default when they have balance
        if (walletType === 'trustwallet-mobile') {
            console.log('✅ USDT token will appear in TrustWallet when you receive tokens');
            showToast('✅ Ready to use USDT! Token will appear when you have balance.', 'success');
        }
        
    } catch (error) {
        // Non-critical error, just log it
        console.log('Auto-import note:', error.message);
    }
}

// Handle Connection Errors
function handleConnectionError(error) {
    let errorMessage = error.message || 'Failed to connect wallet';
    
    if (errorMessage.includes('not found') || errorMessage.includes('install')) {
        errorMessage = '❌ No wallet detected. Please use TrustWallet mobile app or install TronLink extension.';
    } else if (errorMessage.includes('unlock') || errorMessage.includes('locked')) {
        errorMessage = '🔒 Please unlock your wallet and try again.';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = '❌ Connection rejected. Please approve the connection in your wallet.';
    }
    
    showToast(errorMessage, 'error');
}

// Initialize USDT Contract
async function initializeContract() {
    try {
        usdtContract = await tronWeb.contract(TRC20_ABI, USDT_CONTRACT);
        console.log('✅ USDT Contract initialized:', USDT_CONTRACT);
    } catch (error) {
        console.error('Contract initialization error:', error);
        throw new Error('Failed to initialize USDT contract. Please try again.');
    }
}

// Update Wallet UI
function updateWalletUI(walletName = 'Wallet') {
    walletInfo.style.display = 'block';
    walletAddressEl.textContent = formatAddress(userAddress);
    connectWalletBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" fill="#4CAF50"/>
            <path d="M6 10L9 13L14 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Connected (${walletName})
    `;
    connectWalletBtn.style.background = '#28a745';
    connectWalletBtn.disabled = true;
}

// Update Balances
async function updateBalances() {
    try {
        // Get TRX Balance
        const trxBalance = await tronWeb.trx.getBalance(userAddress);
        const trxAmount = tronWeb.fromSun(trxBalance);
        trxBalanceEl.textContent = parseFloat(trxAmount).toFixed(2);

        // Get USDT Balance
        const usdtBalance = await usdtContract.balanceOf(userAddress).call();
        const usdtAmount = tronWeb.toDecimal(usdtBalance) / 1000000; // USDT has 6 decimals
        usdtBalanceEl.textContent = usdtAmount.toFixed(2);
        availableBalanceEl.textContent = usdtAmount.toFixed(2);

        console.log('💰 Balances updated:', { trx: trxAmount, usdt: usdtAmount });
    } catch (error) {
        console.error('Balance update error:', error);
        showToast('⚠️ Failed to fetch balances. Retrying...', 'warning');
        
        // Retry once after 2 seconds
        setTimeout(async () => {
            try {
                await updateBalances();
            } catch (retryError) {
                console.error('Balance retry failed:', retryError);
            }
        }, 2000);
    }
}

// Handle Send Transaction
async function handleSendTransaction(e) {
    e.preventDefault();
    
    const recipientAddress = document.getElementById('recipientAddress').value.trim();
    const amount = document.getElementById('amount').value;

    // Validation
    if (!recipientAddress || !amount) {
        showToast('⚠️ Please fill in all fields', 'warning');
        return;
    }

    if (!tronWeb.isAddress(recipientAddress)) {
        showToast('❌ Invalid recipient address. Must be a valid TRON address (starting with T)', 'error');
        return;
    }

    if (parseFloat(amount) <= 0) {
        showToast('❌ Amount must be greater than 0', 'error');
        return;
    }

    // Check if user has enough balance
    const currentBalance = parseFloat(availableBalanceEl.textContent);
    if (parseFloat(amount) > currentBalance) {
        showToast('❌ Insufficient USDT balance', 'error');
        return;
    }

    try {
        showLoading(true);
        showToast('📝 Preparing transaction...', 'info');

        // Convert amount to contract format (6 decimals for USDT)
        const amountInSun = Math.floor(parseFloat(amount) * 1000000);

        console.log('💸 Sending transaction:', {
            from: userAddress,
            to: recipientAddress,
            amount: amount,
            amountInSun: amountInSun
        });

        // Send USDT
        const transaction = await usdtContract.transfer(
            recipientAddress,
            amountInSun
        ).send({
            feeLimit: 100000000,
            callValue: 0,
            shouldPollResponse: true
        });

        console.log('✅ Transaction sent:', transaction);

        showToast(`✅ Successfully sent ${amount} USDT!`, 'success');

        // Clear form
        sendForm.reset();

        // Update balances after 3 seconds
        setTimeout(async () => {
            await updateBalances();
        }, 3000);

    } catch (error) {
        console.error('Transaction error:', error);
        
        let errorMessage = 'Transaction failed';
        
        if (error.message) {
            if (error.message.includes('Insufficient')) {
                errorMessage = '❌ Insufficient balance or TRX for fees';
            } else if (error.message.includes('REVERT')) {
                errorMessage = '❌ Transaction reverted - Please ensure you have enough TRX for fees';
            } else if (error.message.includes('Confirmation') || error.message.includes('cancel')) {
                errorMessage = '❌ Transaction cancelled by user';
            } else if (error.message.includes('denied')) {
                errorMessage = '❌ Transaction rejected in wallet';
            } else {
                errorMessage = `❌ ${error.message}`;
            }
        }
        
        showToast(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// Utility Functions
function formatAddress(address) {
    if (!address) return '-';
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
}

function copyToClipboard(text, message = 'Copied!') {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`✅ ${message}`, 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(`✅ ${message}`, 'success');
        } catch (err) {
            showToast('❌ Failed to copy', 'error');
        }
        document.body.removeChild(textArea);
    });
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Auto-refresh balances every 30 seconds when connected
setInterval(async () => {
    if (walletConnected && userAddress) {
        try {
            await updateBalances();
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }
}, 30000);

// Export for debugging
window.usdtStore = {
    getAddress: () => userAddress,
    getBalance: async () => {
        if (usdtContract && userAddress) {
            const balance = await usdtContract.balanceOf(userAddress).call();
            return tronWeb.toDecimal(balance) / 1000000;
        }
        return 0;
    },
    refresh: updateBalances,
    reconnect: connectWallet,
    contractAddress: USDT_CONTRACT,
    walletType: () => walletType,
    isTrustWallet: () => walletType === 'trustwallet-mobile'
};

console.log('🚀 USDT Store initialized');
console.log('📝 Contract: TH6dmHZ3iCrnceceGDYa4L8adUCDakLwpw');
console.log('🌐 Network: TRON Mainnet (TRC20)');
console.log('📱 Supports: TrustWallet Mobile + TronLink');
console.log('💡 Debug: usdtStore.walletType()');

