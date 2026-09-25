/**
 * Wallet network-switch logic tests (mocked EIP-1193 provider).
 *
 * Verifies the exact failure shapes MetaMask can throw — including plain
 * objects rather than Error instances — produce readable behavior and that
 * account connection never fails just because the network switch did.
 *
 * Run with:  npx tsx test/wallet-switch.test.mts
 */

import assert from "node:assert/strict";
import * as configMod from "../src/lib/config";
import * as clientMod from "../src/lib/genlayer/client";

// CJS/ESM interop tolerant unwrapping (tsx transpile mode dependent).
/* eslint-disable @typescript-eslint/no-explicit-any */
const configModule = (configMod as any).default ?? (configMod as any);
const client = (clientMod as any).default ?? (clientMod as any);
const config: { contractAddress: string; chainId: number; chainIdHex: string } =
  configModule.resolveAppConfig();
const spec: { chainId: number; chainIdHex: string; chainName: string; rpcUrl: string; nativeSymbol: string } =
  client.networkSpecOf(config);
/* eslint-enable @typescript-eslint/no-explicit-any */

type Handler = (params?: unknown) => Promise<unknown>;

/** Swap in a mock window.ethereum for a scenario map (module reads it lazily). */
function mockWallet(handlers: Record<string, Handler>) {
  (globalThis as Record<string, unknown>).window = {
    ethereum: {
      isMetaMask: true,
      request: ({ method, params }: { method: string; params?: unknown }) => {
        const handler = handlers[method];
        if (!handler) throw new Error(`unmocked method ${method}`);
        return handler(params);
      },
      on: () => {},
      removeListener: () => {},
    },
  };
}

const HEX_TARGET = spec.chainIdHex;
let passed = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    console.error(`  ✘ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

/* 1. Already on the target chain → no-op, zero writes. */
await check("no-op when already on the target chain", async () => {
  mockWallet({
    eth_chainId: async () => HEX_TARGET,
    wallet_switchEthereumChain: async () => {
      throw new Error("must not be called");
    },
  });
  await client.switchToNetwork(spec);
});

/* 2. Plain-object 4901 error (not an Error instance) → add → succeed. */
await check("4901 plain-object error triggers add + add succeeds", async () => {
  let added = false;
  mockWallet({
    eth_chainId: async () => (added ? HEX_TARGET : "0x1"),
    wallet_switchEthereumChain: async () => {
      throw { code: 4901, message: "Unrecognized chain ID" }; // NOT an Error
    },
    wallet_addEthereumChain: async () => {
      added = true;
      return null;
    },
  });
  await client.switchToNetwork(spec);
  assert.equal(added, true);
});

/* 3. Add rejected with a bare object (no message) → readable failure, never "[object Object]". */
await check("bare-object rejection produces readable message", async () => {
  mockWallet({
    eth_chainId: async () => "0x1",
    wallet_switchEthereumChain: async () => {
      throw { code: 4902 };
    },
    wallet_addEthereumChain: async () => {
      throw { code: -32603 }; // no message at all — the old "[object Object]" case
    },
  });
  await assert.rejects(client.switchToNetwork(spec), (err: Error) => {
    assert.match(err.message, /Could not add the network/);
    assert.doesNotMatch(err.message, /\[object Object\]/);
    return true;
  });
});

/* 4. User rejection is reported clearly. */
await check("4001 rejection surfaces rejection message", async () => {
  mockWallet({
    eth_chainId: async () => "0x1",
    wallet_switchEthereumChain: async () => {
      throw { code: 4001, message: "User rejected the request." };
    },
  });
  await assert.rejects(client.switchToNetwork(spec), /rejected/);
});

/* 5. Pending-request guidance. */
await check("-32002 surfaces pending-request guidance", async () => {
  mockWallet({
    eth_chainId: async () => "0x1",
    wallet_switchEthereumChain: async () => {
      throw { code: -32002, message: "Request of type 'wallet_switchEthereumChain' already pending" };
    },
  });
  await assert.rejects(client.switchToNetwork(spec), /pending/);
});

/* 6. Connection survives a failed switch (the reported bug). */
await check("connectMetaMask connects even when the switch fails", async () => {
  mockWallet({
    eth_requestAccounts: async () => ["0x1111111111111111111111111111111111111111"],
    eth_chainId: async () => "0x1",
    wallet_switchEthereumChain: async () => {
      throw { code: 4901 };
    },
    wallet_addEthereumChain: async () => {
      throw { code: -32603 };
    },
  });
  const result = await client.connectMetaMask(spec);
  assert.equal(result.address, "0x1111111111111111111111111111111111111111");
  assert.equal(typeof result.networkSwitchError, "string");
  assert.notEqual(result.networkSwitchError, null);
  assert.doesNotMatch(result.networkSwitchError ?? "", /\[object Object\]/);
});

/* 0. Chain constants are always valid (regression: empty env → 0xNaN; wrong hex). */
await check("chain id constants resolve to 61999 / 0xf22f", async () => {
  assert.equal(spec.chainId, 61999);
  assert.match(HEX_TARGET, /^0x[0-9a-f]+$/);
  assert.equal(HEX_TARGET, "0xf22f"); // 61999 decimal — never 0xNaN
  assert.doesNotMatch(HEX_TARGET, /NaN/i);
});

/* 7. Connection on the correct chain skips all write calls. */
await check("connectMetaMask on correct chain performs no writes", async () => {
  mockWallet({
    eth_requestAccounts: async () => ["0x2222222222222222222222222222222222222222"],
    eth_chainId: async () => HEX_TARGET,
    wallet_switchEthereumChain: async () => {
      throw new Error("must not be called");
    },
    wallet_addEthereumChain: async () => {
      throw new Error("must not be called");
    },
  });
  const result = await client.connectMetaMask(spec);
  assert.equal(result.networkSwitchError, null);
});

/* 9. SDK integration recipe used by the bridge (regressions):
   a) string account at createClient → viem normalizes client.account into a
      json-rpc account object (fixes "Address 'undefined' is invalid"), and
   b) wallet RPC methods (eth_sendTransaction) route to the injected
      provider — NOT the RPC gateway (fixes "Method not found").
*/
await check("string account normalizes + send routes via provider", async () => {
  const { createClient } = await import("genlayer-js");
  const { studionet } = await import("genlayer-js/chains");

  const raw = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
  const routedMethods: string[] = [];
  const fakeTxHash = `0x${"ab".repeat(32)}`;

  const mockProvider = {
    request: async ({ method }: { method: string; params?: unknown[] }) => {
      routedMethods.push(method);
      if (method === "eth_chainId") return HEX_TARGET;
      if (method === "eth_sendTransaction") return fakeTxHash;
      throw new Error(`provider received unexpected method: ${method}`);
    },
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const client = createClient({
    chain: studionet,
    account: raw as `0x${string}`, // what the bridge now passes
    provider: mockProvider as any,
    endpoint: "https://studio.genlayer.com/api",
  } as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // (a) the SDK sender path needs client.account.address — strings must be
  // normalized by viem into a json-rpc account object.
  const account = (client as unknown as { account: { address?: string; type?: string } }).account;
  assert.equal(account.type, "json-rpc");
  assert.equal(typeof account.address, "string");
  assert.match(account.address as string, /^0x[a-fA-F0-9]{40}$/);
  assert.notEqual(account.address, undefined);

  // (b) with a string-configured account, eth_sendTransaction must reach the
  // injected provider rather than the （studio) RPC gateway.
  const methodsBefore = routedMethods.length;
  const hash = await client.request({
    method: "eth_sendTransaction",
    params: [{ from: raw, to: raw, value: "0x0" }],
  } as never);
  assert.equal(hash, fakeTxHash);
  assert.ok(
    routedMethods.slice(methodsBefore).includes("eth_sendTransaction"),
    "provider should have received eth_sendTransaction",
  );
});

/* 10. writeContract (e.g. submit_defense) executes properly with wrapped provider */
await check("writeContract submit_defense executes cleanly with provider", async () => {
  const { createClient } = await import("genlayer-js");
  const { studionet } = await import("genlayer-js/chains");

  const raw = "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063";
  let sendTransactionCalled = false;
  const fakeTxHash = `0x${"ef".repeat(32)}`;

  const mockInjected = {
    request: async ({ method }: { method: string; params?: unknown[] }) => {
      if (method === "eth_chainId") return HEX_TARGET;
      if (method === "eth_sendTransaction") {
        sendTransactionCalled = true;
        return fakeTxHash;
      }
      if (method === "eth_gasPrice") return "0x0";
      return null;
    },
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const client = createClient({
    chain: studionet,
    account: raw as `0x${string}`,
    provider: mockInjected as any,
    endpoint: "https://studio.genlayer.com/api",
  } as any);

  const txHash = await client.writeContract({
    address: "0xc3f49B0AbD1957dcc8f05742cBB29751cEcACf97",
    functionName: "submit_defense",
    args: [1, "This is my defense statement with sufficient length", "https://example.org"] as never,
    value: 0n,
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  assert.equal(sendTransactionCalled, true);
  assert.equal(txHash, fakeTxHash);
});

console.log(`\n${passed}/10 wallet-switch scenarios passed.`);
