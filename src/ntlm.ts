import http from "node:http";
import https from "node:https";
import axios, { AxiosAdapter, AxiosError, AxiosHeaders } from "axios";
import { createType1Message, parseType2Message, createType3Message } from "@node-ntlm/core";

interface NtlmCredentials {
  username: string;
  password: string;
  domain: string;
  workstation: string;
}

export function readNtlmCredentials(): NtlmCredentials {
  let username = process.env.SEVENPACE_USERNAME || "";
  let domain = process.env.SEVENPACE_DOMAIN || "";
  if (username.includes("\\")) {
    const separator = username.indexOf("\\");
    domain ||= username.slice(0, separator);
    username = username.slice(separator + 1);
  }
  const password = process.env.SEVENPACE_PASSWORD || "";
  if (!username || !password) {
    throw new Error("NTLM requires SEVENPACE_USERNAME and SEVENPACE_PASSWORD");
  }
  return { username, password, domain, workstation: process.env.SEVENPACE_WORKSTATION || "" };
}

// Each handshake owns one keep-alive connection. No subprocesses or OS credentials.
export const ntlmAdapter: AxiosAdapter = async (config) => {
  const credentials = readNtlmCredentials();
  const target = new URL(axios.getUri(config));
  const origin = new URL(config.baseURL!);
  if (target.origin !== origin.origin || target.username || target.password) {
    throw new Error("NTLM requests must use the configured origin without URL credentials");
  }
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 1 });
  const transport = axios.create({
    adapter: "http", httpAgent, httpsAgent, maxRedirects: 0, proxy: false,
    timeout: config.timeout || 15000, validateStatus: () => true,
    maxContentLength: 16 * 1024 * 1024,
  });
  const headers = AxiosHeaders.from(config.headers);
  headers.delete("Authorization");
  headers.set("Connection", "keep-alive");
  const type1 = createType1Message(credentials);
  try {
    const challenge = await transport.request({
      url: target.href, method: config.method, headers: { ...headers.toJSON(), Authorization: type1 },
      signal: config.signal, responseType: "text",
    });
    if (challenge.status !== 401) {
      throw new Error("NTLM server did not return an authentication challenge (HTTP " + challenge.status + ")");
    }
    const offered = String(challenge.headers["www-authenticate"] || "");
    const match = /(?:^|,\s*)(NTLM|Negotiate)\s+([A-Za-z0-9+/=]+)/i.exec(offered);
    if (!match) throw new Error("Server did not return an NTLM challenge");
    const type2 = parseType2Message("NTLM " + match[2]);
    if (type2.signature.toString("ascii") !== "NTLMSSP\0" ||
        !(type2.negotiateFlags & 0x80000) || !type2.targetInfo?.length) {
      throw new Error("Server must support NTLMv2; legacy NTLMv1 is not supported");
    }
    const type3 = createType3Message(type2, credentials).replace(/^NTLM /, match[1] + " ");
    const response = await transport.request({
      url: target.href, method: config.method, data: config.data,
      headers: { ...headers.toJSON(), Authorization: type3 },
      signal: config.signal, responseType: "text",
    });
    const result = { ...response, config };
    if (config.validateStatus && !config.validateStatus(response.status)) {
      throw new AxiosError("7pace API returned HTTP " + response.status,
        AxiosError.ERR_BAD_RESPONSE, config, undefined, result);
    }
    return result;
  } finally {
    httpAgent.destroy();
    httpsAgent.destroy();
  }
};
