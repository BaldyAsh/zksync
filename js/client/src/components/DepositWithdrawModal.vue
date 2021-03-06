<template>
    <div>
        Token:
        <TokenSelector 
            class="mb-2"
            :tokens="tokensForTokenSelector"
            :selected.sync="token">
        </TokenSelector>
        <div>
            Amount <span v-if="maxAmountVisible">(<span v-if="tokenReadablyPrintable">in {{ token }} coins, </span>max {{ displayableBalancesDict[token] }} {{ token }})</span>:
            <b-form-input autocomplete="off" v-model="amountSelected" class="mb-2"></b-form-input>
            <div v-if="feeNeeded">
                Fee:
                <FeeSelector 
                    class="mb-2"
                    :fees="fees"
                    :selected.sync="feeButtonSelectedIndex">
                </FeeSelector>
            </div>
            <div v-else>
                The fee is <b>ETH</b> {{ depositFee }}. The change will be put on your ZK Sync account.
            </div>
            <p v-if="alertVisible"> {{ alertText }} </p>
            <b-button class="w-50 mt-3" variant="primary" @click='buttonClicked'> {{ buttonText }} </b-button>
        </div>
    </div>
</template>

<script>
import { utils } from 'ethers'
import { getDisplayableBalanceDict, feesFromAmount, isReadablyPrintable } from '../utils'

import TokenSelector from './TokenSelector.vue'
import FeeSelector from './FeeSelector.vue'

const components = {
    TokenSelector,
    FeeSelector,
};

export default {
    name: 'DepositWithdrawModal',
    props: [
        'buttonText',
        'balances',
        'feeNeeded',
    ],
    data: () => ({
        token: null,

        amountSelected: null,
        feeButtonSelectedIndex: null,
        fees: ['0%', '1%', '5%'],

        maxAmountVisible: false,
        balancesDict: {},
        displayableBalancesDict: {},
        alertVisible: false,
        alertText: '',
        depositFee: '',

        tokensForTokenSelector: null,
    }),
    async created() {
        this.depositFee = await window.walletDecorator.getDepositFee();
        this.createDisplayableBalancesDict();
    },
    watch: {
        balances() {
            this.createDisplayableBalancesDict();
        },
        token() {
            this.maxAmountVisible = true;
        },
    },
    computed: {
        tokenReadablyPrintable() {
            return isReadablyPrintable(this.token);
        },
    },
    methods: {
        localDisplayAlert(msg) {
            this.alertVisible = true;
            this.alertText = msg;
        },
        createDisplayableBalancesDict() {
            if (this.balances) {
                this.tokensForTokenSelector = this.balances.map(b => b.tokenName);

                this.balancesDict = this.balances
                    .reduce((acc, bal) => {
                        acc[bal.tokenName] = bal.amount;
                        return acc;
                    }, {});
                this.displayableBalancesDict = getDisplayableBalanceDict(this.balancesDict);
            }
        },
        getAmount() {
            try {
                return isReadablyPrintable(this.token)
                    ? utils.parseEther(this.amountSelected)
                    : utils.bigNumberify(this.amountSelected);
            } catch (e) {
                console.log('amount compute error: ', e);
                return null;
            }
        },
        getFee() {
            try {
                let amount = this.getAmount();
                return feesFromAmount(amount)[this.feeButtonSelectedIndex];
            } catch (e) {
                console.log('getFee error:', e);
                return null;
            }
        },
        async buttonClicked() {
            if (!this.token) {
                this.localDisplayAlert(`Please select token.`);
                return;
            }

            if (this.amountSelected == null) {
                this.localDisplayAlert(`Please select amount`);
                return;
            }

            let amount = this.getAmount();
            if (amount == null) {
                this.localDisplayAlert(`Please input valid amount value`);
                return;
            }

            if (this.feeNeeded) {
                if (this.feeButtonSelectedIndex == null) {
                    this.localDisplayAlert(`Please select fee`);
                    return;
                }
                
                var fee = this.getFee();
                if (fee == null) {
                    this.localDisplayAlert(`Problem with fee.`); // TODO:
                    return;
                }
    
                if (amount.add(fee).gt(utils.bigNumberify(this.balancesDict[this.token]))) {
                    this.localDisplayAlert(`The amount is too large.`);
                    return;
                }
            } else {
                let fee = utils.parseEther(this.depositFee);
                let tooMuch = (this.token == 'ETH' && amount.add(fee).gt(utils.bigNumberify(this.balancesDict[this.token])))
                    || (amount.gt(utils.bigNumberify(this.balancesDict[this.token])));

                if (tooMuch) {
                    this.localDisplayAlert(`The amount is too large.`);
                    return;
                }
            }

            this.$emit('buttonClicked', {
                token: this.token,
                amount: amount,
                fee: fee,
            });
        }
    },
    components,
}
</script>
