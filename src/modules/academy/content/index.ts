// Starter curriculum, in display order. Only ever read by ensureSeeded().
import blockchain from "./blockchain-fundamentals.json";
import btcEth from "./bitcoin-ethereum.json";
import contracts from "./smart-contracts.json";
import defi from "./defi-lending.json";
import dex from "./dex-perps.json";
import trading from "./trading-fundamentals.json";
import wallets from "./wallets-security.json";
import nfts from "./nfts-ownership.json";
import layers from "./layer1-layer2.json";
import bridges from "./cross-chain-bridges.json";
import daos from "./daos-governance.json";
import oracles from "./oracles-infrastructure.json";
import zk from "./zero-knowledge.json";
import ecosystem from "./web3-ecosystem.json";

export const SEED: unknown[] = [blockchain, btcEth, contracts, defi, dex, trading, wallets, nfts, layers, bridges, daos, oracles, zk, ecosystem];
