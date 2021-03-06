import {
    depositFromETH,
    Wallet,
    Provider,
    ETHProxy, getDefaultProvider, types
} from "zksync";
import { ethers, utils } from "ethers";

let syncProvider: Provider;

let CLIENTS_TOTAL = 10;
let DEPOSIT_AMOUNT = "1.0";
let TRANSFER_AMOUNT = "0.0001";
let FEE_DIVISOR = 20;
let TRANSFERS_TOTAL = 100;

(async () => {
    const WEB3_URL = process.env.WEB3_URL;
    const MNEMONIC = process.env.MNEMONIC;

    const network = process.env.ETH_NETWORK == "localhost" ? "localhost" : "testnet";
    console.log("Running loadtest on the ", network, " network");

    syncProvider = await getDefaultProvider(network);

    try {
        const ethersProvider = new ethers.providers.JsonRpcProvider(WEB3_URL);
        const ethProxy = new ETHProxy(ethersProvider, syncProvider.contractAddress);

        const ethWallet = ethers.Wallet.fromMnemonic(
            MNEMONIC,
            "m/44'/60'/0'/0/1"
        ).connect(ethersProvider);
        const syncWallet = await Wallet.fromEthWallet(
            ethWallet,
            syncProvider,
            ethProxy
        );

        const ethWallets = [];
        const syncWallets = [];

        ethWallets.push(ethWallet);
        syncWallets.push(syncWallet);

        // Create wallets
        var i = 1;
        while (i < CLIENTS_TOTAL) {
            let ew = ethers.Wallet.createRandom().connect(ethersProvider);
            let sw = await Wallet.fromEthWallet(
                ew,
                syncProvider,
                ethProxy
            );
            ethWallets.push(ew);
            syncWallets.push(sw);

            i++;
        }

        // Deposits
        i = 0;
        while  (i < CLIENTS_TOTAL) {
            await depositEther(ethWallets[0], syncWallets[i], DEPOSIT_AMOUNT);
            i++;
        }

        // Transfers
        i = 0;
        while(i < TRANSFERS_TOTAL) {
            let number1 = randomClientNumber();
            var number2 = randomClientNumber();
            while (number2 == number1) {
                number2 = randomClientNumber();
            }
            let client1 = syncWallets[number1];
            let client2 = syncWallets[number2];

            await transferEther(client1, client2, TRANSFER_AMOUNT);
            i++;
        }

        // Withdraws
        i = 0;
        while  (i < CLIENTS_TOTAL) {
            await withdrawEther(ethWallets[i], syncWallets[i]);
            i++;
        }

        await syncProvider.disconnect();
    } catch (err) {
        await syncProvider.disconnect();
        throw err
    } 

})();

function randomClientNumber() {
    return Math.floor(Math.random() * CLIENTS_TOTAL);
}

async function depositEther(ethWallet: ethers.Wallet, syncWallet: Wallet, amount: string) {
    try {
        const token = "ETH";
    
        const depositAmount = utils.parseEther(amount);
        const fee = depositAmount.div(FEE_DIVISOR);

        const balanceBeforeDep = await syncWallet.getBalance(token);
        const depositHandle = await depositFromETH(
        {
            depositFrom: ethWallet,
            depositTo:  syncWallet,
            token: token,
            amount: depositAmount,
            maxFeeInETHToken: fee
        });
        await depositHandle.awaitReceipt();
        const balanceAfterDep = await syncWallet.getBalance(token);

        if (!balanceAfterDep.sub(balanceBeforeDep).eq(depositAmount)) {
            throw new Error("Deposit checks failed");
        }

        console.log(`Ether deposit ok, from: ${ethWallet.address}, to: ${syncWallet.address()}, amount: ${amount}, fee: ${utils.formatEther(fee)}`);
    } catch (err) {
        console.log(`Deposit ether error: ${err}`)
        throw err
    }
}

async function transferEther(syncWallet1: Wallet, syncWallet2: Wallet, amount: string) {
    try {
        const token = "ETH";
        const wallet1BeforeTransfer = await syncWallet1.getBalance(token);
        const wallet2BeforeTransfer = await syncWallet2.getBalance(token);
        const operatorBeforeTransfer = await getOperatorBalance(token);
        const transferAmount = utils.parseEther(amount);
        const fee = transferAmount.div(FEE_DIVISOR);
        const transferToNewHandle = await syncWallet1.syncTransfer({
            to: syncWallet2.address(),
            token,
            amount: transferAmount,
            fee
        });
        await transferToNewHandle.awaitReceipt();
        const wallet1AfterTransfer = await syncWallet1.getBalance(token);
        const wallet2AfterTransfer = await syncWallet2.getBalance(token);
        const operatorAfterTransfer = await getOperatorBalance(token);

        let transferCorrect = true;
        transferCorrect = transferCorrect && wallet1BeforeTransfer.sub(wallet1AfterTransfer).eq(transferAmount.add(fee));
        transferCorrect = transferCorrect && wallet2AfterTransfer.sub(wallet2BeforeTransfer).eq(transferAmount);
        transferCorrect = transferCorrect && operatorAfterTransfer.sub(operatorBeforeTransfer).eq(fee);
        if (!transferCorrect) {
            throw new Error("Transfer checks failed");
        }

        console.log(`Ether transfer ok, from: ${syncWallet1.address()}, to: ${syncWallet2.address()}, amount: ${amount}, fee: ${utils.formatEther(fee)}`);
    } catch (err) {
        console.log(`Transfer ether error: ${err}`)
        throw err
    }
}

async function withdrawEther(ethWallet: ethers.Wallet, syncWallet: Wallet) {
    try {
        const token = "ETH";

        const wallet2BeforeWithdraw = await syncWallet.getBalance(token);
        const operatorBeforeWithdraw = await getOperatorBalance(token);
        const fee = utils.parseEther(TRANSFER_AMOUNT).div(FEE_DIVISOR);
        const amount = wallet2BeforeWithdraw.sub(fee);
        const withdrawHandle = await syncWallet.withdrawTo({
            ethAddress: ethWallet.address,
            token,
            amount,
            fee
        });
        await withdrawHandle.awaitReceipt();
        const wallet2AfterWithdraw = await syncWallet.getBalance(token);
        const operatorAfterWithdraw = await getOperatorBalance(token);

        let withdrawCorrect = true;
        withdrawCorrect = withdrawCorrect && wallet2BeforeWithdraw.sub(wallet2AfterWithdraw).eq(amount.add(fee));
        withdrawCorrect = withdrawCorrect && operatorAfterWithdraw.sub(operatorBeforeWithdraw).eq(fee);

        if (!withdrawCorrect) {
            throw new Error("Withdraw checks failed");
        }

        console.log(`Ether withdraw ok, from: ${syncWallet.address()}, to: ${ethWallet.address}, amount: ${utils.formatEther(amount)}, fee: ${utils.formatEther(fee)}`);
    } catch (err) {
        console.log(`Withdraw ether error: ${err}`)
        throw err
    }
}

async function getOperatorBalance(token: types.Token, type: "committed" | "verified" = "committed") {
    try {
        const accountState = await syncProvider.getState(process.env.OPERATOR_FRANKLIN_ADDRESS);
        if (token != "ETH") {
            token = token.toLowerCase();
        }
        let balance;
        if (type == "committed") {
            balance = accountState.committed.balances[token] || "0";
        } else {
            balance = accountState.verified.balances[token] || "0";
        }
        return utils.bigNumberify(balance);
    } catch (err) {
        console.log(`get operator balance error: ${err}`)
        throw err
    }
}
