/**
 * This file is part of Radicale Server - Calendar Server
 * Copyright © 2026-2026 Max Berger <max@berger.name>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Collection, CollectionType } from "../models/collection.js";

// Namespace URL: 6ba7b811-9dad-11d1-80b4-00c04fd430c8
const NS_URL = new Uint8Array([
    0x6b, 0xa7, 0xb8, 0x11,
    0x9d, 0xad,
    0x11, 0xd1,
    0x80, 0xb4,
    0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8
]);

/**
 * Generate UUID Version 5 using Web Cryptography API (SHA-1) with ns:URL.
 * @param {string} name
 * @param {Uint8Array} [ns]
 * @returns {Promise<string>}
 */
export async function uuidv5(name, ns = NS_URL) {
    const nameBytes = new TextEncoder().encode(name);
    const combined = new Uint8Array(ns.length + nameBytes.length);
    combined.set(ns, 0);
    combined.set(nameBytes, ns.length);

    const hashBuffer = await crypto.subtle.digest("SHA-1", combined);
    const digest = new Uint8Array(hashBuffer);

    // Set version 5
    digest[6] = (digest[6] & 0x0f) | 0x50;
    // Set variant RFC 4122
    digest[8] = (digest[8] & 0x3f) | 0x80;

    const hex = Array.from(digest.subarray(0, 16))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Convert a URL into reverse-DNS style identifier using '.' delimiters.
 * @param {string} urlStr
 * @returns {string}
 */
export function url_to_reverse_dns(urlStr) {
    const fallbackBase = (typeof window !== "undefined" && window.location && window.location.href)
        ? window.location.href
        : "http://localhost/";
    const url = new URL(urlStr, fallbackBase);
    const hostParts = url.hostname.split(".").filter(p => p.length > 0).reverse();
    const cleanPath = url.pathname.replace(/^\/+|\/+$/g, "");
    const pathParts = cleanPath.split("/").filter(p => p.length > 0);
    return [...hostParts, ...pathParts].join(".");
}

/**
 * XML escape a string with fallback to string replacement.
 * @param {string} [str]
 * @returns {string}
 */
export function escapeXml(str) {
    if (!str) return "";
    if (typeof document !== "undefined") {
        return new XMLSerializer().serializeToString(document.createTextNode(str));
    }
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Generate Apple Configuration Profile XML string.
 * @param {string} user
 * @param {?Collection} [principal_collection]
 * @param {Collection[]} [collections]
 * @returns {Promise<string>}
 */
export async function generate_mobileconfig(user, principal_collection, collections) {
    const fallbackBase = (typeof window !== "undefined" && window.location && window.location.href)
        ? window.location.href
        : "http://localhost/";
    const href = (principal_collection && principal_collection.href) ? principal_collection.href : `/${user}/`;
    const url = new URL(href, fallbackBase);
    const baseUrl = url.href.replace(/\/+$/, "");
    const baseIdentifier = url_to_reverse_dns(url.href);
    const rootUUID = await uuidv5(baseUrl);

    const hasCalendars = !collections || collections.length === 0 || collections.some(c => c.type !== CollectionType.ADDRESSBOOK && c.type !== "PRINCIPAL");
    const hasContacts = !collections || collections.length === 0 || collections.some(c => c.type === CollectionType.ADDRESSBOOK);

    let displayName = user ? `Radicale Calendar & Contacts for ${user}` : "Radicale Calendar & Contacts";
    if (hasCalendars && !hasContacts) {
        displayName = user ? `Radicale Calendar for ${user}` : "Radicale Calendar";
    } else if (!hasCalendars && hasContacts) {
        displayName = user ? `Radicale Contacts for ${user}` : "Radicale Contacts";
    }

    const useSSL = url.protocol === "https:";
    /** @type {string[]} */
    const payloads = [];

    const portBlock = (url.port && url.port !== "80" && url.port !== "443")
        ? `<key>CalDAVPort</key><integer>${parseInt(url.port, 10)}</integer>`
        : "";
    const cardPortBlock = (url.port && url.port !== "80" && url.port !== "443")
        ? `<key>CardDAVPort</key><integer>${parseInt(url.port, 10)}</integer>`
        : "";
    const principalPath = url.pathname
        ? `<key>CalDAVPrincipalURL</key><string>${escapeXml(url.pathname)}</string>`
        : "";
    const cardPrincipalPath = url.pathname
        ? `<key>CardDAVPrincipalURL</key><string>${escapeXml(url.pathname)}</string>`
        : "";

    if (hasCalendars) {
        const caldavId = `${baseIdentifier}.caldav`;
        const caldavUUID = await uuidv5(`${baseUrl}.caldav`);
        payloads.push(
            `<dict>` +
            `<key>PayloadType</key><string>com.apple.caldav.account</string>` +
            `<key>PayloadVersion</key><integer>1</integer>` +
            `<key>PayloadIdentifier</key><string>${escapeXml(caldavId)}</string>` +
            `<key>PayloadUUID</key><string>${caldavUUID}</string>` +
            `<key>CalDAVAccountDescription</key><string>${escapeXml(user ? `Radicale Calendar for ${user}` : "Radicale Calendar")}</string>` +
            `<key>CalDAVHostName</key><string>${escapeXml(url.hostname)}</string>` +
            `<key>CalDAVUsername</key><string>${escapeXml(user)}</string>` +
            `<key>CalDAVUseSSL</key><${useSSL ? "true" : "false"}/>` +
            `${portBlock}${principalPath}` +
            `</dict>`
        );
    }

    if (hasContacts) {
        const carddavId = `${baseIdentifier}.carddav`;
        const carddavUUID = await uuidv5(`${baseUrl}.carddav`);
        payloads.push(
            `<dict>` +
            `<key>PayloadType</key><string>com.apple.carddav.account</string>` +
            `<key>PayloadVersion</key><integer>1</integer>` +
            `<key>PayloadIdentifier</key><string>${escapeXml(carddavId)}</string>` +
            `<key>PayloadUUID</key><string>${carddavUUID}</string>` +
            `<key>CardDAVAccountDescription</key><string>${escapeXml(user ? `Radicale Contacts for ${user}` : "Radicale Contacts")}</string>` +
            `<key>CardDAVHostName</key><string>${escapeXml(url.hostname)}</string>` +
            `<key>CardDAVUsername</key><string>${escapeXml(user)}</string>` +
            `<key>CardDAVUseSSL</key><${useSSL ? "true" : "false"}/>` +
            `${cardPortBlock}${cardPrincipalPath}` +
            `</dict>`
        );
    }

    return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` +
        `<plist version="1.0"><dict>` +
        `<key>PayloadType</key><string>Configuration</string>` +
        `<key>PayloadVersion</key><integer>1</integer>` +
        `<key>PayloadIdentifier</key><string>${escapeXml(baseIdentifier)}</string>` +
        `<key>PayloadUUID</key><string>${rootUUID}</string>` +
        `<key>PayloadDisplayName</key><string>${escapeXml(displayName)}</string>` +
        `<key>PayloadContent</key><array>${payloads.join("")}</array>` +
        `</dict></plist>`
    );
}

/**
 * Generate and download a virtual .mobileconfig file for the user.
 * @param {string} user
 * @param {?Collection} [principal_collection]
 * @param {Collection[]} [collections]
 * @returns {Promise<void>}
 */
export async function download_mobileconfig(user, principal_collection, collections) {
    const xmlContent = await generate_mobileconfig(user, principal_collection, collections);
    const blob = new Blob([xmlContent], { type: "application/x-apple-aspen-config" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (user ? `${user}.mobileconfig` : "radicale.mobileconfig");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}
