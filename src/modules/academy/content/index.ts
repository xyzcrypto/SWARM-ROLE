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
import perpMaster from "./perp-dex-masterclass.json";
import onchain from "./onchain-trading.json";
import rwa from "./rwa-tokenization.json";
import prop from "./prop-firms.json";
import airdrops from "./airdrop-masterclass.json";
import aiCrypto from "./ai-crypto.json";
import quantum from "./quantum-computing.json";

/** Batch 1: the original fourteen topics. */
export const SEED: unknown[] = [blockchain, btcEth, contracts, defi, dex, trading, wallets, nfts, layers, bridges, daos, oracles, zk, ecosystem];

/** Batch 2: advanced tracks (Perp DEX, on-chain trading, RWA, prop firms, airdrops, AI, quantum). */
export const SEED_V2: unknown[] = [perpMaster, onchain, rwa, prop, airdrops, aiCrypto, quantum];

/** Installed in order; see ensureSeeded(). */
export const SEED_BATCHES: { version: number; files: unknown[] }[] = [
  { version: 1, files: SEED },
  { version: 2, files: SEED_V2 },
];
