#[macro_use]
extern crate serde_derive;
#[macro_use]
extern crate log;

pub mod abi;
pub mod circuit;
pub mod merkle_tree;
pub mod node;
pub mod params;
pub mod primitives;

// TODO: refactor, find new home for all this stuff

use crate::node::account::{Account, AccountAddress};
use crate::node::block::Block;
use crate::node::AccountUpdates;
use crate::node::BlockNumber;
use serde_bytes;
use std::sync::mpsc::Sender;
use web3::types::U256;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxMeta {
    pub addr: String,
    pub nonce: u32,
}

#[derive(Default, Debug, Serialize, Deserialize, Clone)]
pub struct NetworkStatus {
    pub next_block_at_max: Option<u64>,
    pub last_committed: BlockNumber,
    pub last_verified: BlockNumber,
    pub total_transactions: u32,
    pub outstanding_txs: u32,
}

pub type EncodedProof = [U256; 8];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub struct EthBlockData {
    #[serde(with = "serde_bytes")]
    public_data: Vec<u8>,
}

pub struct ProverRequest(pub BlockNumber);

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Action {
    Commit,
    Verify { proof: Box<EncodedProof> },
}

impl Action {
    pub fn get_type(&self) -> ActionType {
        match self {
            Action::Commit => ActionType::COMMIT,
            Action::Verify { .. } => ActionType::VERIFY,
        }
    }
}

impl std::string::ToString for Action {
    fn to_string(&self) -> String {
        self.get_type().to_string()
    }
}

impl std::fmt::Debug for Action {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    pub id: Option<i64>,
    pub action: Action,
    pub block: Block,
    pub accounts_updated: AccountUpdates,
}

pub enum StateKeeperRequest {
    GetAccount(AccountAddress, Sender<Option<Account>>),
    GetNetworkStatus(Sender<NetworkStatus>),
    TimerTick,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommitRequest {
    pub block: Block,
    pub accounts_updated: AccountUpdates,
}

pub const ACTION_COMMIT: &str = "COMMIT";
pub const ACTION_VERIFY: &str = "VERIFY";

#[derive(PartialEq, Eq, PartialOrd, Ord, Clone, Copy, Serialize, Deserialize)]
pub enum ActionType {
    COMMIT,
    VERIFY,
}

impl std::string::ToString for ActionType {
    fn to_string(&self) -> String {
        match self {
            ActionType::COMMIT => ACTION_COMMIT.to_owned(),
            ActionType::VERIFY => ACTION_VERIFY.to_owned(),
        }
    }
}

impl std::str::FromStr for ActionType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            ACTION_COMMIT => Ok(Self::COMMIT),
            ACTION_VERIFY => Ok(Self::VERIFY),
            _ => Err(format!(
                "Should be either: {} or {}",
                ACTION_COMMIT, ACTION_VERIFY
            )),
        }
    }
}
