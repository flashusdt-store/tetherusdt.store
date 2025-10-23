// USDT Store - Universal TRON Wallet Support (TrustWallet & TronLink)
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

// Simple, robust wallet detection
async function detectWallet() {
    let attempts = 0;
    const maxAttempts = 10; // Increased to 10 seconds
    
    const checkWallet = async () => {
        attempts++;
        console.log(`🔍 Detection attempt ${attempts}/${maxAttempts}`);
        
        // Debug: Log what's available
        console.log('window.tronWeb:', !!window.tronWeb);
        console.log('window.tronLink:', !!window.tronLink);
        console.log('window.trustwallet:', !!window.trustwallet);
        
        // Simple check: Do we have tronWeb?
        if (window.tronWeb) {
            console.log('✅ tronWeb found!');
            
            // Determine wallet type
            const userAgent = navigator.userAgent || '';
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
            const isTrustUA = /Trust/i.test(userAgent);
            
            if (isTrustUA || window.trustwallet) {
                walletType = 'TrustWallet';
                console.log('📱 TrustWallet detected');
            } else if (window.tronLink) {
                walletType = 'TronLink';
                console.log('🔗 TronLink detected');
            } else if (isMobile) {
                walletType = 'Mobile Wallet';
                console.log('📱 Mobile wallet detected');
            } else {
                walletType = 'TRON Wallet';
                console.log('💼 TRON wallet detected');
            }
            
            // Check if ready
            if (window.tronWeb.ready) {
                showToast(`✅ ${walletType} detected and ready! Click "Connect Wallet".`, 'success');
            } else {
                showToast(`📱 ${walletType} detected! Click "Connect Wallet".`, 'success');
            }
            
            return true;
        }
        
        // Keep checking
        if (attempts < maxAttempts) {
            setTimeout(checkWallet, 1000);
        } else {
            console.log('❌ No wallet detected after 10 seconds');
            showToast('⚠️ No TRON wallet detected. Please use TrustWallet mobile app or install TronLink.', 'warning');
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

// Universal Connect Wallet (works with any TRON wallet)
async function connectWallet() {
    try {
        showLoading(true);
        console.log('🔗 Starting connection...');
        
        // Check if tronWeb exists
        if (!window.tronWeb) {
            throw new Error('No TRON wallet found. Please use TrustWallet mobile app or install TronLink extension.');
        }

        // If tronWeb is not ready, wait for it or request access
        if (!window.tronWeb.ready) {
            console.log('⏳ Waiting for wallet to be ready...');
            
            // Try TronLink's request method if available
            if (window.tronLink && window.tronLink.request) {
                console.log('🔓 Requesting TronLink access...');
                try {
                    const res = await window.tronLink.request({ 
                        method: 'tron_requestAccounts' 
                    });
                    
                    if (res.code === 200) {
                        console.log('✅ TronLink access granted');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else if (res.code === 4001) {
                        throw new Error('Connection rejected. Please approve the connection.');
                    }
                } catch (e) {
                    console.log('TronLink request failed:', e.message);
                }
            }
            
            // Wait for tronWeb to be ready (works for all wallets)
            let readyAttempts = 0;
            while (!window.tronWeb.ready && readyAttempts < 15) {
                console.log(`⏳ Waiting for wallet... attempt ${readyAttempts + 1}/15`);
                await new Promise(resolve => setTimeout(resolve, 500));
                readyAttempts++;
            }
            
            if (!window.tronWeb.ready) {
                throw new Error('Wallet is not ready. Please unlock your wallet and try again.');
            }
        }

        // Now we should have ready tronWeb
        tronWeb = window.tronWeb;
        console.log('✅ TronWeb is ready!');
        
        // Get user address
        userAddress = tronWeb.defaultAddress.base58;
        
        if (!userAddress || userAddress === 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb') {
            throw new Error('No wallet address found. Please make sure your wallet is unlocked.');
        }

        console.log('✅ Connected to address:', userAddress);

        // Initialize USDT contract
        await initializeContract();

        // Update UI
        walletConnected = true;
        updateWalletUI();
        
        // Fetch balances
        await updateBalances();

        showToast(`✅ ${walletType} connected successfully!`, 'success');
        
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
    
    if (errorMessage.includes('not found') || errorMessage.includes('No TRON wallet')) {
        errorMessage = '❌ No TRON wallet detected. Please use TrustWallet mobile app or install TronLink.';
    } else if (errorMessage.includes('unlock') || errorMessage.includes('not ready')) {
        errorMessage = '🔒 Please unlock your wallet and try again.';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = '❌ Connection rejected. Please approve in your wallet.';
    } else if (errorMessage.includes('address')) {
        errorMessage = '❌ No wallet address found. Make sure your wallet is unlocked.';
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
    contractAddress: USDT_CONTRACT,
    walletType: () => walletType,
    debug: () => {
        console.log('=== DEBUG INFO ===');
        console.log('Wallet Type:', walletType);
        console.log('Connected:', walletConnected);
        console.log('Address:', userAddress);
        console.log('tronWeb:', !!window.tronWeb);
        console.log('tronWeb.ready:', window.tronWeb?.ready);
        console.log('tronLink:', !!window.tronLink);
        console.log('trustwallet:', !!window.trustwallet);
        console.log('User Agent:', navigator.userAgent);
    }
};

console.log('🚀 USDT Store Initialized');
console.log('📝 Contract:', USDT_CONTRACT);
console.log('🌐 Network: TRON Mainnet');
console.log('💡 Type "usdtStore.debug()" for debug info');
