import { PublicKey, VersionedTransaction } from "@solana/web3.js";

export function collectStaticAccountKeys(tx: VersionedTransaction): PublicKey[] {
  const msg = tx.message;
  const keys = msg.getAccountKeys();
  const staticKeys = keys.staticAccountKeys;
  const out: PublicKey[] = [...staticKeys];
  const lookupTables = msg.addressTableLookups ?? [];
  for (const lut of lookupTables) {
    out.push(lut.accountKey);
  }
  return dedupePubkeys(out);
}

export function collectProgramIdsFromInstructions(
  tx: VersionedTransaction,
): PublicKey[] {
  const msg = tx.message;
  const keys = msg.getAccountKeys();
  const programs: PublicKey[] = [];

  if ("compiledInstructions" in msg && Array.isArray(msg.compiledInstructions)) {
    for (const ix of msg.compiledInstructions) {
      const pid = keys.get(ix.programIdIndex);
      if (pid) programs.push(pid);
    }
  } else if ("instructions" in msg && Array.isArray(msg.instructions)) {
    for (const ix of msg.instructions) {
      const pid = keys.get(ix.programIdIndex);
      if (pid) programs.push(pid);
    }
  }

  return dedupePubkeys(programs);
}

function dedupePubkeys(keys: PublicKey[]): PublicKey[] {
  const seen = new Set<string>();
  const out: PublicKey[] = [];
  for (const k of keys) {
    const s = k.toBase58();
    if (!seen.has(s)) {
      seen.add(s);
      out.push(k);
    }
  }
  return out;
}
