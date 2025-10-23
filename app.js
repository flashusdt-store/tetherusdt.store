// USDT Store - Enhanced Wallet Integration
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
let walletType = null; // 'tronlink' or 'trustwallet'

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

// Detect available wallet
async function detectWallet() {
    let attempts = 0;
    const maxAttempts = 5;
    
    const checkWallet = async () => {
        attempts++;
        
        // Check for TronLink (Browser Extension)
        if (window.tronLink) {
            console.log('TronLink detected!');
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
        
        // Check for TrustWallet (Mobile DApp Browser)
        if (window.ethereum && window.ethereum.isTrust) {
            console.log('TrustWallet detected!');
            walletType = 'trustwallet';
            showToast('✅ TrustWallet detected! Click "Connect Wallet" to continue.', 'success');
            return true;
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

// Setup Event Listeners
function setupEventListeners() {
    connectWalletBtn.addEventListener('click', connectWallet);
    copyAddressBtn.addEventListener('click', () => copyToClipboard(userAddress, 'Address copied!'));
    copyContractBtn.addEventListener('click', () => copyToClipboard(USDT_CONTRACT, 'Contract address copied!'));
    sendForm.addEventListener('submit', handleSendTransaction);

    // Listen for TronLink account changes
    window.addEventListener('message', (e) => {
        if (e.data.message && e.data.message.action === 'setAccount') {
            console.log('TronLink account changed');
            if (walletConnected) {
                showToast('Wallet account changed. Reconnecting...', 'info');
                setTimeout(() => location.reload(), 1500);
            }
        }
        
        if (e.data.message && e.data.message.action === 'accountsChanged') {
            console.log('Accounts changed');
            if (walletConnected) {
                showToast('Wallet account changed. Reconnecting...', 'info');
                setTimeout(() => location.reload(), 1500);
            }
        }
    });
}

// Connect Wallet Function (Enhanced)
async function connectWallet() {
    try {
        showLoading(true);
        
        // TronLink Connection
        if (window.tronLink || window.tronWeb) {
            await connectTronLink();
        }
        // TrustWallet or other Web3 wallets
        else if (window.ethereum) {
            showToast('Please use TronLink for TRON network', 'error');
            window.open('https://www.tronlink.org/', '_blank');
        }
        // No wallet detected
        else {
            throw new Error('No wallet detected. Please install TronLink extension or use TronLink mobile app.');
        }

    } catch (error) {
        console.error('Connection error:', error);
        handleConnectionError(error);
    } finally {
        showLoading(false);
    }
}

// Connect TronLink Wallet
async function connectTronLink() {
    try {
        // Check if TronLink exists
        if (!window.tronLink && !window.tronWeb) {
            throw new Error('TronLink not found. Please install TronLink extension.');
        }

        // Wait for TronLink to be ready
        if (!window.tronWeb || !window.tronWeb.ready) {
            // Request account access - this will prompt user to unlock
            showToast('🔓 Please unlock TronLink and approve the connection...', 'info');
            
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

        console.log('✅ Connected to wallet:', userAddress);

        // Initialize USDT contract
        await initializeContract();

        // Auto-import USDT token to wallet
        await autoImportToken();

        // Update UI
        walletConnected = true;
        updateWalletUI();
        
        // Fetch balances
        await updateBalances();

        showToast('✅ Wallet connected successfully! USDT token imported.', 'success');
        
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
        // TronLink supports adding custom tokens
        if (window.tronLink) {
            console.log('Attempting to auto-import USDT token...');
            
            // Try to add token using TronLink's method
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
                    console.log('✅ USDT token auto-imported to wallet');
                    showToast('✅ USDT token imported to your wallet!', 'success');
                }
            } catch (tokenError) {
                // Token might already be added or method not supported
                console.log('Token auto-import:', tokenError.message || 'Token may already exist in wallet');
            }
        }
    } catch (error) {
        // Non-critical error, just log it
        console.log('Auto-import note:', error.message);
    }
}

// Handle Connection Errors
function handleConnectionError(error) {
    let errorMessage = error.message || 'Failed to connect wallet';
    let actionButton = null;
    
    if (errorMessage.includes('not found') || errorMessage.includes('install')) {
        errorMessage = '❌ TronLink not detected. Please install TronLink extension.';
        actionButton = () => window.open('https://www.tronlink.org/', '_blank');
    } else if (errorMessage.includes('unlock') || errorMessage.includes('locked')) {
        errorMessage = '🔒 Please unlock your TronLink wallet and try again.';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = '❌ Connection rejected. Please approve the connection in TronLink.';
    }
    
    showToast(errorMessage, 'error');
    
    if (actionButton) {
        setTimeout(actionButton, 2000);
    }
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
function updateWalletUI() {
    walletInfo.style.display = 'block';
    walletAddressEl.textContent = formatAddress(userAddress);
    connectWalletBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" fill="#4CAF50"/>
            <path d="M6 10L9 13L14 8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Connected
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

        console.log('Balances updated:', { trx: trxAmount, usdt: usdtAmount });
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

        console.log('Sending transaction:', {
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
                errorMessage = '❌ Transaction rejected in TronLink';
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
    }, 4000); // Increased to 4 seconds for better readability
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
    walletType: () => walletType
};

console.log('🚀 USDT Store initialized');
console.log('📝 Contract Address:', USDT_CONTRACT);
console.log('🌐 Network: TRON Mainnet (TRC20)');
console.log('💡 Debug commands: usdtStore.getAddress(), usdtStore.getBalance(), usdtStore.refresh()');
