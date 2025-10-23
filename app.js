// USDT Store - TronLink Wallet Integration
// TRC20 USDT Contract Address
const USDT_CONTRACT = 'TH6dmHZ3iCrnceceGDYa4L8adUCDakLwpw';

// Application State
let walletConnected = false;
let userAddress = null;
let tronWeb = null;
let usdtContract = null;
let walletType = 'unknown';

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
    console.log('🔍 Starting wallet detection...');
    console.log('User Agent:', navigator.userAgent);
    await detectWallet();
    setupEventListeners();
});

// TronLink Detection
async function detectWallet() {
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkWallet = async () => {
        attempts++;
        console.log(`🔍 TronLink detection attempt ${attempts}/${maxAttempts}`);
        
        // Check for TronLink
        if (window.tronWeb && window.tronLink) {
            console.log('✅ TronLink detected!');
            walletType = 'TronLink';
            
            if (window.tronWeb.ready) {
                showToast('✅ TronLink ready! Click "Connect Wallet".', 'success');
            } else {
                showToast('🔗 TronLink detected! Please unlock and click "Connect Wallet".', 'warning');
            }
            
            return true;
        }
        
        // Keep checking
        if (attempts < maxAttempts) {
            setTimeout(checkWallet, 1000);
        } else {
            console.log('❌ TronLink not found');
            showToast('⚠️ TronLink not detected. Please install TronLink extension.', 'warning');
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

    // Listen for account changes
    window.addEventListener('message', (e) => {
        if (e.data.message && (e.data.message.action === 'setAccount' || e.data.message.action === 'accountsChanged')) {
            console.log('🔄 Wallet account changed');
            if (walletConnected) {
                showToast('Wallet account changed. Reconnecting...', 'info');
                setTimeout(() => location.reload(), 1500);
            }
        }
    });
}

// Connect TronLink Wallet
async function connectWallet() {
    try {
        showLoading(true);
        console.log('🔗 Connecting to TronLink...');
        
        // Check TronLink
        if (!window.tronWeb || !window.tronLink) {
            throw new Error('TronLink not detected. Please install TronLink extension.');
        }

        tronWeb = window.tronWeb;
        
        // Wait for TronLink to be ready
        let readyAttempts = 0;
        while (!tronWeb.ready && readyAttempts < 10) {
            console.log(`⏳ Waiting for TronLink to be ready... attempt ${readyAttempts + 1}`);
            await new Promise(resolve => setTimeout(resolve, 500));
            readyAttempts++;
        }
        
        if (!tronWeb.ready) {
            throw new Error('TronLink is not ready. Please unlock your wallet.');
        }
        
        // Request access
        console.log('🔓 Requesting TronLink access...');
        const res = await window.tronLink.request({ 
            method: 'tron_requestAccounts' 
        });
        
        if (res.code === 200) {
            console.log('✅ TronLink access granted');
            await new Promise(resolve => setTimeout(resolve, 500));
        } else if (res.code === 4001) {
            throw new Error('Connection rejected. Please approve the connection.');
        } else {
            throw new Error('Failed to request access. Please approve in TronLink.');
        }
        
        // Get wallet address
        const address = tronWeb.defaultAddress.base58;
        if (!address || address === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb') {
            throw new Error('Could not get wallet address. Please make sure TronLink is unlocked.');
        }
        
        userAddress = address;
        walletType = 'TronLink';
        console.log('✅ Connected to TronLink:', userAddress);

        // Initialize USDT contract
        await initializeContract();

        // Update UI
        walletConnected = true;
        updateWalletUI();
        
        // Fetch balances
        await updateBalances();

        // Auto-import USDT token
        await addUSDTToWallet();

        showToast('✅ TronLink connected successfully!', 'success');
        
        // Hide instructions, show transaction form
        instructionsCard.style.display = 'none';
        transactionForm.style.display = 'block';

    } catch (error) {
        console.error('❌ Connection error:', error);
        handleConnectionError(error);
    } finally {
        showLoading(false);
    }
}

// Handle Connection Errors
function handleConnectionError(error) {
    let errorMessage = error.message || 'Failed to connect wallet';
    
    if (errorMessage.includes('not detected') || errorMessage.includes('TronLink not detected')) {
        errorMessage = '❌ TronLink not detected. Please install TronLink extension.';
    } else if (errorMessage.includes('not ready') || errorMessage.includes('unlock')) {
        errorMessage = '🔒 Please unlock TronLink and try again.';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = '❌ Connection rejected. Please approve in TronLink.';
    } else if (errorMessage.includes('address')) {
        errorMessage = '❌ No wallet address found. Make sure TronLink is unlocked.';
    }
    
    showToast(errorMessage, 'error');
}

// Initialize USDT Contract
async function initializeContract() {
    try {
        console.log('📝 Initializing USDT contract...');
        usdtContract = await tronWeb.contract(TRC20_ABI, USDT_CONTRACT);
        console.log('✅ USDT Contract initialized');
    } catch (error) {
        console.error('Contract initialization error:', error);
        throw new Error('Failed to initialize USDT contract. Please try again.');
    }
}

// Add USDT token to wallet (TronLink support)
async function addUSDTToWallet() {
    try {
        console.log('🪙 Attempting to add USDT token to wallet...');
        
        // TronLink supports wallet_watchAsset
        if (window.tronLink && window.tronLink.request) {
            console.log('🔄 Requesting TronLink to add USDT token...');
            
            const wasAdded = await window.tronLink.request({
                method: 'wallet_watchAsset',
                params: {
                    type: 'trc20', // Note: trc20, not ERC20!
                    options: {
                        address: USDT_CONTRACT,
                        symbol: 'USDT',
                        decimals: 6,
                        image: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
                    }
                }
            });
            
            if (wasAdded) {
                console.log('✅ USDT token added to TronLink wallet!');
                showToast('✅ USDT token added to your wallet!', 'success');
            } else {
                console.log('ℹ️ USDT token not added (user may have cancelled or it already exists)');
            }
        } else {
            console.log('ℹ️ TronLink API not available - token auto-import not supported');
            console.log('💡 Token will appear automatically when you have USDT balance');
        }
    } catch (error) {
        // Non-critical error - don't fail the connection
        console.log('Token auto-import note:', error.message || error);
        console.log('💡 You can manually add USDT token later if needed');
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
        console.log('💰 Fetching balances...');
        
        // Get TRX Balance
        const trxBalance = await tronWeb.trx.getBalance(userAddress);
        const trxAmount = tronWeb.fromSun(trxBalance);
        trxBalanceEl.textContent = parseFloat(trxAmount).toFixed(2);

        // Get USDT Balance
        const usdtBalance = await usdtContract.balanceOf(userAddress).call();
        const usdtAmount = tronWeb.toDecimal(usdtBalance) / 1000000; // USDT has 6 decimals
        usdtBalanceEl.textContent = usdtAmount.toFixed(2);
        availableBalanceEl.textContent = usdtAmount.toFixed(2);

        console.log('✅ Balances:', { TRX: trxAmount, USDT: usdtAmount });
    } catch (error) {
        console.error('Balance update error:', error);
        showToast('⚠️ Failed to fetch balances. Retrying...', 'warning');
        
        // Retry once
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
        showToast('❌ Invalid TRON address (must start with T)', 'error');
        return;
    }

    if (parseFloat(amount) <= 0) {
        showToast('❌ Amount must be greater than 0', 'error');
        return;
    }

    // Check balance
    const currentBalance = parseFloat(availableBalanceEl.textContent);
    if (parseFloat(amount) > currentBalance) {
        showToast('❌ Insufficient USDT balance', 'error');
        return;
    }

    try {
        showLoading(true);
        showToast('📝 Preparing transaction...', 'info');

        // Convert amount to contract format (6 decimals)
        const amountInSun = Math.floor(parseFloat(amount) * 1000000);

        console.log('💸 Sending:', {
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
                errorMessage = '❌ Transaction reverted - Need more TRX for fees';
            } else if (error.message.includes('cancel')) {
                errorMessage = '❌ Transaction cancelled';
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
        // Fallback
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

// Auto-refresh balances every 30 seconds
setInterval(async () => {
    if (walletConnected && userAddress) {
        try {
            await updateBalances();
        } catch (error) {
            console.error('Auto-refresh error:', error);
        }
    }
}, 30000);

// Debug helpers
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
    addToken: addUSDTToWallet, // Manual token import
    contractAddress: USDT_CONTRACT,
    walletType: () => walletType,
    debug: () => {
        console.log('=== TronLink DEBUG INFO ===');
        console.log('Wallet Type:', walletType);
        console.log('Connected:', walletConnected);
        console.log('Address:', userAddress);
        console.log('tronWeb:', !!window.tronWeb);
        console.log('tronWeb.ready:', window.tronWeb?.ready);
        console.log('tronLink:', !!window.tronLink);
        console.log('tronLink.request:', !!(window.tronLink?.request));
        console.log('User Agent:', navigator.userAgent);
    }
};

console.log('🚀 USDT Store Initialized');
console.log('📝 Contract:', USDT_CONTRACT);
console.log('🌐 Network: TRON Mainnet');
console.log('💡 Type "usdtStore.debug()" for debug info');
