# This file is part of Radicale - CalDAV and CardDAV server
# Copyright © 2026-2026 Max Berger <max@berger.name>
#
# This library is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This library is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Radicale.  If not, see <http://www.gnu.org/licenses/>.

"""
Integration tests for mobileconfig feature
"""

import pathlib
import plistlib
from typing import Any, Generator

import pytest
from playwright.sync_api import BrowserContext, Page, expect

from integ_tests.common import (NOSHARE_HTPASSWD, SHARING_HTPASSWD,
                                SHARING_XREMOTE, AuthType, Config, SharingType,
                                login, start_radicale_server)


@pytest.fixture(
    params=[SHARING_HTPASSWD, SHARING_XREMOTE, NOSHARE_HTPASSWD], ids=lambda c: c.name
)
def config(request: pytest.FixtureRequest) -> Config:
    return request.param


@pytest.fixture
def radicale_server(
    tmp_path: pathlib.Path, config: Config
) -> Generator[str, Any, None]:
    yield from start_radicale_server(tmp_path, config)


def test_mobileconfig_button_hidden_by_default(
    context: BrowserContext, page: Page, radicale_server: str, config: Config
) -> None:
    login(page, radicale_server, config, context=context)
    expect(page.locator("#collectionsscene")).to_be_visible()
    expect(page.locator('#collectionsscene a[data-name="mobileconfig"]')).to_be_hidden()


def test_mobileconfig_button_visible_and_downloads_file(
    context: BrowserContext, tmp_path: pathlib.Path, page: Page
) -> None:
    mobileconfig_cfg = Config(
        name="mobileconfig_enabled",
        auth_type=AuthType.HTPASSWD,
        sharing_type=SharingType.NOSHARING,
        web_extra="mobileconfig = True\n",
    )
    for server_url in start_radicale_server(tmp_path, mobileconfig_cfg):
        login(page, server_url, mobileconfig_cfg, context=context)
        expect(page.locator("#collectionsscene")).to_be_visible()
        mobileconfig_btn = page.locator('#collectionsscene a[data-name="mobileconfig"]')
        expect(mobileconfig_btn).to_be_visible()

        with page.expect_download() as download_info:
            mobileconfig_btn.click()

        expect(page.locator("#collectionsscene")).to_be_visible()
        expect(page.locator("#loginscene")).to_be_hidden()

        download = download_info.value
        assert download.suggested_filename.endswith(".mobileconfig")

        download_path = download.path()
        with open(download_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert '<?xml version="1.0" encoding="UTF-8"?>' in content
        assert (
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
            in content
        )
        assert '<plist version="1.0">' in content
        assert "<key>PayloadType</key>" in content
        assert "<string>Configuration</string>" in content
        assert "<key>PayloadVersion</key>" in content
        assert "<key>PayloadIdentifier</key>" in content
        assert "<key>PayloadUUID</key>" in content
        assert "<key>PayloadContent</key>" in content
        assert "com.apple.caldav.account" in content
        assert "com.apple.carddav.account" in content
        assert "CalDAVHostName" in content
        assert "CardDAVHostName" in content
        assert "<key>CalDAVUsername</key>" in content
        assert f"<string>{mobileconfig_cfg.admin_username}</string>" in content
        assert "</plist>" in content


def test_mobileconfig_calendar_only(
    context: BrowserContext, tmp_path: pathlib.Path, page: Page
) -> None:
    mobileconfig_cfg = Config(
        name="mobileconfig_cal_only",
        auth_type=AuthType.HTPASSWD,
        sharing_type=SharingType.NOSHARING,
        web_extra="mobileconfig = True\n",
    )
    for server_url in start_radicale_server(tmp_path, mobileconfig_cfg):
        login(page, server_url, mobileconfig_cfg, context=context)
        expect(page.locator("#collectionsscene")).to_be_visible()

        # Create a calendar
        page.click('.fabcontainer a[data-name="new"]')
        page.select_option(
            '#createcollectionscene select[data-name="type"]', "CALENDAR"
        )
        page.locator('#createcollectionscene input[data-name="displayname"]').fill(
            "MyCalendar"
        )
        page.click('#createcollectionscene button[data-name="submit"]')
        expect(page.locator("#collectionsscene")).to_be_visible()

        mobileconfig_btn = page.locator('#collectionsscene a[data-name="mobileconfig"]')
        with page.expect_download() as download_info:
            mobileconfig_btn.click()

        download = download_info.value
        download_path = download.path()
        with open(download_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "com.apple.caldav.account" in content
        assert "com.apple.carddav.account" not in content
        assert "<key>PayloadDisplayName</key>" in content
        assert f"<string>Radicale Calendar for {mobileconfig_cfg.admin_username}</string>" in content


def test_mobileconfig_contacts_only(
    context: BrowserContext, tmp_path: pathlib.Path, page: Page
) -> None:
    mobileconfig_cfg = Config(
        name="mobileconfig_contacts_only",
        auth_type=AuthType.HTPASSWD,
        sharing_type=SharingType.NOSHARING,
        web_extra="mobileconfig = True\n",
    )
    for server_url in start_radicale_server(tmp_path, mobileconfig_cfg):
        login(page, server_url, mobileconfig_cfg, context=context)
        expect(page.locator("#collectionsscene")).to_be_visible()

        # Create an address book
        page.click('.fabcontainer a[data-name="new"]')
        page.select_option(
            '#createcollectionscene select[data-name="type"]', "ADDRESSBOOK"
        )
        page.locator('#createcollectionscene input[data-name="displayname"]').fill(
            "MyContacts"
        )
        page.click('#createcollectionscene button[data-name="submit"]')
        expect(page.locator("#collectionsscene")).to_be_visible()

        mobileconfig_btn = page.locator('#collectionsscene a[data-name="mobileconfig"]')
        with page.expect_download() as download_info:
            mobileconfig_btn.click()

        download = download_info.value
        download_path = download.path()
        with open(download_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "com.apple.carddav.account" in content
        assert "com.apple.caldav.account" not in content
        assert "<key>PayloadDisplayName</key>" in content
        assert f"<string>Radicale Contacts for {mobileconfig_cfg.admin_username}</string>" in content


def test_mobileconfig_multiple_calendars_and_contacts(
    context: BrowserContext, tmp_path: pathlib.Path, page: Page
) -> None:
    mobileconfig_cfg = Config(
        name="mobileconfig_multiple",
        auth_type=AuthType.HTPASSWD,
        sharing_type=SharingType.NOSHARING,
        web_extra="mobileconfig = True\n",
    )
    for server_url in start_radicale_server(tmp_path, mobileconfig_cfg):
        login(page, server_url, mobileconfig_cfg, context=context)
        expect(page.locator("#collectionsscene")).to_be_visible()

        # Create two calendars
        for cal_name in ["Calendar 1", "Calendar 2"]:
            page.click('.fabcontainer a[data-name="new"]')
            page.select_option(
                '#createcollectionscene select[data-name="type"]', "CALENDAR"
            )
            page.locator('#createcollectionscene input[data-name="displayname"]').fill(
                cal_name
            )
            page.click('#createcollectionscene button[data-name="submit"]')
            expect(page.locator("#collectionsscene")).to_be_visible()

        # Create two address books
        for ab_name in ["Address Book 1", "Address Book 2"]:
            page.click('.fabcontainer a[data-name="new"]')
            page.select_option(
                '#createcollectionscene select[data-name="type"]', "ADDRESSBOOK"
            )
            page.locator('#createcollectionscene input[data-name="displayname"]').fill(
                ab_name
            )
            page.click('#createcollectionscene button[data-name="submit"]')
            expect(page.locator("#collectionsscene")).to_be_visible()

        mobileconfig_btn = page.locator('#collectionsscene a[data-name="mobileconfig"]')
        with page.expect_download() as download_info:
            mobileconfig_btn.click()

        download = download_info.value
        download_path = download.path()
        with open(download_path, "rb") as f:
            parsed = plistlib.load(f)

        assert parsed["PayloadType"] == "Configuration"
        assert parsed["PayloadVersion"] == 1
        assert parsed["PayloadDisplayName"] == f"Radicale Calendar & Contacts for {mobileconfig_cfg.admin_username}"
        assert len(parsed["PayloadContent"]) == 2

        caldav_payload = next(
            p for p in parsed["PayloadContent"] if p["PayloadType"] == "com.apple.caldav.account"
        )
        carddav_payload = next(
            p for p in parsed["PayloadContent"] if p["PayloadType"] == "com.apple.carddav.account"
        )

        assert caldav_payload["CalDAVAccountDescription"] == f"Radicale Calendar for {mobileconfig_cfg.admin_username}"
        assert caldav_payload["CalDAVUsername"] == mobileconfig_cfg.admin_username
        assert caldav_payload["CalDAVPrincipalURL"] == f"/{mobileconfig_cfg.admin_username}/"

        assert carddav_payload["CardDAVAccountDescription"] == f"Radicale Contacts for {mobileconfig_cfg.admin_username}"
        assert carddav_payload["CardDAVUsername"] == mobileconfig_cfg.admin_username
        assert carddav_payload["CardDAVPrincipalURL"] == f"/{mobileconfig_cfg.admin_username}/"

        # Ensure all payload UUIDs and identifiers are unique
        uuids = [parsed["PayloadUUID"], caldav_payload["PayloadUUID"], carddav_payload["PayloadUUID"]]
        assert len(set(uuids)) == 3
        identifiers = [
            parsed["PayloadIdentifier"],
            caldav_payload["PayloadIdentifier"],
            carddav_payload["PayloadIdentifier"],
        ]
        assert len(set(identifiers)) == 3
