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

import { pop_scene, scene_stack } from "./scene_manager.js";
import { SERVER, ROOT_PATH } from "./constants.js";

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
  this.show = function () {
    this.release();
    scene_index = scene_stack.length - 1;
    html_scene.classList.remove("hidden");
    // submit_btn.onclick = onsubmit;
    cancel_btn.onclick = oncancel;
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

  let request = new XMLHttpRequest();
  request.open(
    "POST",
    SERVER + ROOT_PATH + ".sharing/v1/all/list",
    true,
    user,
    encodeURIComponent(password),
  );
  request.onreadystatechange = function () {
    if (request.readyState !== 4) {
      return;
    }
    if (request.status === 200) {
      let response = JSON.parse(request.responseText);
      add_share_rows(collection, response["Content"] || []);
      console.info(response);
    } else {
      console.error(
        "Failed to load sharing list: " +
          request.status +
          " " +
          request.statusText,
      );
    }
  };
  request.setRequestHeader("Accept", "application/json");
  request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  let collection_without_trailing_slash = collection.href.replace(/\/?$/, ""); // delete trailing slash
  // TODO: 
//   request.send(
//     JSON.stringify({ PathMapped: collection_without_trailing_slash }),
//   );
  request.send(JSON.stringify({}));
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
      node.querySelector("[data-name=pathortoken]").textContent = pathortoken;
      node.querySelector("[data-name=pathmapped]").textContent = pathmapped;
      node.querySelector("[data-name=user]").textContent = share["User"] || "";
      node.querySelector("[data-name=permissions]").textContent =
        share["Permissions"] || "";
      template.parentNode.insertBefore(node, template);
    }
  });
}
