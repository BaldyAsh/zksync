CREATE TABLE eth_operations
(
    id             bigserial primary key,
    op_id          bigserial references operations (id),
    nonce          bigint  not null,
    deadline_block bigint  not null,
    gas_price      numeric not null,
    tx_hash        bytea   not null,
    confirmed      bool    not null default false,
    raw_tx         bytea   not null
);

ALTER TABLE operations
    ADD COLUMN confirmed bool not null default false,
    DROP COLUMN addr CASCADE,
    DROP COLUMN nonce CASCADE,
    DROP COLUMN tx_hash CASCADE
