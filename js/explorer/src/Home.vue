<template>
<div>
    <b-navbar toggleable="md" type="dark" variant="info">
    <b-container>
        <b-navbar-brand>ZK Sync Network</b-navbar-brand>
        <b-navbar-toggle target="nav-collapse"></b-navbar-toggle>
        <b-collapse id="nav-collapse" is-nav>
        <b-navbar-nav>
            <b-nav-item href="/client/" target="_blank" rel="noopener noreferrer">ZK Sync Wallet</b-nav-item>
            <b-nav-item v-bind:href="`${blockchain_explorer_address}/${store.config.CONTRACT_ADDR}`" target="_blank" rel="noopener noreferrer">
                Contract <span style="font-size: 0.9em"><i class="fas fa-external-link-alt"></i></span>
            </b-nav-item>
        </b-navbar-nav>
        <b-navbar-nav class="ml-auto">
            <b-nav-form>
                <SearchField :searchFieldInMenu="true" />
            </b-nav-form>
        </b-navbar-nav>
        </b-collapse>
    </b-container>
    </b-navbar>
    <br>
    <b-container>
        <ClosableJumbotron></ClosableJumbotron>
        <b-card bg-variant="light" >
            <h4>ZK Sync Devnet Block Explorer</h4> 
            <SearchField :searchFieldInMenu="false" />
        </b-card>
        <br>
        <b-card>
        <div class="row" style="color: grey">
            <div class="col-sm text-center">
            <i class="far fa-square"></i> <b>Blocks committed</b><br><span class="num">{{lastCommitted}}</span>
            </div>
            <div class="col-sm text-center">
            <i class="far fa-check-square"></i> <b>Blocks verified</b><br><span class="num">{{lastVerified}}</span>
            </div>
            <div class="col-sm text-center">
            <i class="fas fa-list"></i> <b>Total transactions</b><br><span class="num">{{totalTransactions}}</span>
            </div>
        </div>
        </b-card>
        <br>

        <b-pagination v-if="ready && totalTransactions > perPage" v-model="currentPage" :per-page="perPage" :total-rows="rows" @change="onPageChanged"></b-pagination>
        <b-table responsive id="table" hover outlined :items="items" @row-clicked="onRowClicked" :busy="loading" class="clickable">
            <template v-slot:cell(status)="data"><span v-html="data.item.status"></span></template>
            <template v-slot:cell(new_state_root)="data"><span v-html="data.item.new_state_root"></span></template>
        </b-table>
        <b-pagination v-if="ready && totalTransactions > perPage" v-model="currentPage" :per-page="perPage" :total-rows="rows" @change="onPageChanged"></b-pagination>

    </b-container>
</div>
</template>

<style>

.capitalize:first-letter {
    text-transform: capitalize;
}

.table-container {
  position: relative;
}

.overlay {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.clickable tr {
    cursor: pointer;
}

.num {
    font-size: 3em;
}

@media (max-width: 720px) {
.hide-sm {
    display: none
}
}

@media (max-width: 992px) {
.hide-lg {
    display: none
}
}

h1, h2, h3, h4 {
    font-weight: bold;
}

body {
    font-size: 0.9rem;
}

.btn {
    font-size: 0.8rem;
}

</style>

<script>

import store from './store';
import client from './client';

import ClosableJumbotron from './ClosableJumbotron.vue';
import SearchField from './SearchField.vue';
const components = { 
    ClosableJumbotron,
    SearchField,
};

export default {
    name: 'home',
    created() {
        this.update();
    },
    timers: {
        ticker: { time: 1000, autostart: true, repeat: true }
    },
    methods: {
        ticker() {
            this.update(true);
        },
        onRowClicked(item) {
            this.$router.push('/blocks/' + item.block_number);
        },
        async onPageChanged(page) {
            this.$router.push(`${this.$route.path}?page=${page}`);
            //this.updateBlocks()
        },
        async update(silent) {
            if (!silent) {
                this.loading = true;
            }
            const status = await client.status();
            let newBlocks = false;
            if (status) {
                newBlocks = this.lastCommitted !== status.last_committed || this.lastVerified !== status.last_verified;
                this.lastCommitted = status.last_committed;
                this.lastVerified = status.last_verified;
                this.totalTransactions = status.total_transactions;
            }
            if (newBlocks) {
                this.updateBlocks();
            } else {
                this.loading = false;
            }
        },
        async updateBlocks() {
            let max = this.lastCommitted - (client.PAGE_SIZE * (this.currentPage-1));
            if (max < 0) return;

            let blocks = await client.loadBlocks(max);
            if (blocks) {
                this.blocks = blocks.map( b => ({
                    block_number:   b.block_number,
                    status:         `<b>${b.verified_at ? 'Verified' : 'Committed'}</b>`,
                    new_state_root: `<code>${b.new_state_root.slice(0, 16) + '...' + b.new_state_root.slice(-16)}</code>`,
                    committed_at:   b.committed_at.toString().split('T')[0] + " " + b.committed_at.toString().split('T')[1].split('.')[0],
                    verified_at:    b.verified_at ? (b.verified_at.toString().split('T')[0] + " " + b.verified_at.toString().split('T')[1].split('.')[0]) : null,
                }));
                this.currentPage = this.page;
                this.ready = true;
            }
            this.loading = false;
        },
    },
    watch: {
        '$route' (to, from) {
            this.currentPage = this.page;
            this.updateBlocks();
        },
    },
    computed: {
        page() {
            return this.$route.query.page || 1;
        },
        items() {
            return this.blocks;
        },
        perPage() {
            return client.PAGE_SIZE;
        },
        rows() {
            return this.lastCommitted || 9999;
        },
    },
    data() {
        return {
            lastCommitted:      0,
            lastVerified:       0,
            totalTransactions:  0,
            currentPage:        this.$route.query.page || 1,
            
            txPerBlock:         client.TX_PER_BLOCK(),
            blocks:             [],
            ready:              false,

            loading:            true,

            breadcrumbs: [
                {
                    text: 'Blocks',
                    active: true
                },
            ],
        };
    },
    components,
};
</script>
