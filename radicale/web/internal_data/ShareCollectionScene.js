/**
 * This file is part of Radicale Server - Calendar Server
 * Copyright © 2017-2024 Unrud <unrud@outlook.com>
 * Copyright © 2023-2024 Matthew Hana <matthew.hana@gmail.com>
 * Copyright © 2024-2025 Peter Bieringer <pb@bieringer.de>
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

import {
    add_share_by_token,
    reload_sharing_list,
    server_features,
} from "./api.js";
import { pop_scene, scene_stack } from "./scene_manager.js";

/**
 * @constructor
 * @implements {Scene}
 * @param {string} user
 * @param {string} password
 * @param {Collection} collection The collection on which to edit sharing setting. Must exist.
 */
export function CreateShareCollectionScene(user, password, collection) {
  /** @type {?number} */ let scene_index = null;

  let html_scene = document.getElementById("sharecollectionscene");

  // TODO: Other elements

  //   let submit_btn = html_scene.querySelector("[data-name=submit]");
  let cancel_btn = html_scene.querySelector("[data-name=cancel]");
  let share_by_map_btn = html_scene.querySelector("[data-name=sharebymap]");
  let share_by_token_btn = html_scene.querySelector("[data-name=sharebytoken]");

  let title = html_scene.querySelector("[data-name=title]");

  // TODO: behavior

  function onsubmit() {
    // TODO
  }

  function oncancel() {
    try {
      pop_scene(scene_index - 1);
    } catch (err) {
      console.error(err);
    }
    return false;
  }

  function onsharebytoken() {
    add_share_by_token(user, password, collection, function () {
      update_share_list(user, password, collection);
    });
  }

  this.show = function () {
    this.release();
    scene_index = scene_stack.length - 1;
    html_scene.classList.remove("hidden");
    // submit_btn.onclick = onsubmit;
    cancel_btn.onclick = oncancel;
    // share_by_map_btn.onclick = ;
    share_by_token_btn.onclick = onsharebytoken;
    title.textContent = collection.displayname || collection.href;
    update_share_list(user, password, collection);
  };
  this.hide = function () {
    html_scene.classList.add("hidden");
    // submit_btn.onclick = null;
    cancel_btn.onclick = null;
  };
  this.release = function () {
    scene_index = null;
    // TODO: abort pending requests
  };
}

function update_share_list(user, password, collection) {
  let share_rows = document.querySelectorAll("[data-name=sharerowtemplate]");
  share_rows.forEach(function (row) {
    if (!row.classList.contains("hidden")) {
      row.parentNode.removeChild(row);
    }
  });

  console.info(collection);

  reload_sharing_list(user, password, collection, function (response) {
    console.info("Sharing list loaded", response);
    add_share_rows(collection, response["Content"] || []);
  });
}

function add_share_rows(collection, shares) {
  let template = document.querySelector("[data-name=sharerowtemplate]");
  shares.forEach(function (share) {
    let pathortoken = share["PathOrToken"] || "";
    let pathmapped = share["PathMapped"] || "";
    if (
      collection.href.includes(pathmapped) ||
      collection.href.includes(pathortoken)
    ) {
      let node = template.cloneNode(true);
      node.classList.remove("hidden");
      node.querySelector("[data-name=type]").textContent =
        share["ShareType"] || "";
      node.querySelector("[data-name=pathortoken]").value = pathortoken;
      node.querySelector("[data-name=pathmapped]").value = pathmapped;
      node.querySelector("[data-name=user]").textContent = share["User"] || "";
      node.querySelector("[data-name=permissions]").textContent =
        share["Permissions"] || "";
      template.parentNode.insertBefore(node, template);
    }
  });
}

export function maybe_enable_sharing_options() {
  if (!server_features["sharing"]) return;
  let map_is_enabled =
    server_features["sharing"]["FeatureEnabledCollectionByMap"] || false;
  let token_is_enabled =
    server_features["sharing"]["FeatureEnabledCollectionByToken"] || false;
  if (map_is_enabled || token_is_enabled) {
    let share_options = document.querySelectorAll("[data-name=shareoption]");
    for (let i = 0; i < share_options.length; i++) {
      let share_option = share_options[i];
      share_option.classList.remove("hidden");
    }
  }
}
