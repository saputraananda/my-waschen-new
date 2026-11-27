/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "26675d523e4c7eade2caec7494b75aef"
  }, {
    "url": "assets/zap-DWcmL55F.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-D3RZxrX6.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-BAWXOO7p.js",
    "revision": null
  }, {
    "url": "assets/upload-BrhUVFQY.js",
    "revision": null
  }, {
    "url": "assets/truck-BmhTP_x-.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-YWwom2rv.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-Daf5cXdm.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-CmDOeNYR.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-CHJ-5WZJ.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-CLGwv5_-.js",
    "revision": null
  }, {
    "url": "assets/store-Bgrz58DH.js",
    "revision": null
  }, {
    "url": "assets/sparkles-B-xpJJIz.js",
    "revision": null
  }, {
    "url": "assets/shirt-rKXAq1DI.js",
    "revision": null
  }, {
    "url": "assets/send-DMUY98Zb.js",
    "revision": null
  }, {
    "url": "assets/search-RU7VHyWN.js",
    "revision": null
  }, {
    "url": "assets/save-DhBG4FWx.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-JonnbWCg.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-DTi65UVB.js",
    "revision": null
  }, {
    "url": "assets/qr-code-DT9tIV1W.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-CNfBPwGh.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-CGU_1zBv.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-BEI6IsmT.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-BGF89zQD.js",
    "revision": null
  }, {
    "url": "assets/plus-BrOgEQwd.js",
    "revision": null
  }, {
    "url": "assets/pen-line-Yz7kKiaR.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-CmVf13yO.js",
    "revision": null
  }, {
    "url": "assets/paperclip-BsG2jleZ.js",
    "revision": null
  }, {
    "url": "assets/package-CMpmi6c2.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-BKhvIWLX.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-WCaAVDu2.js",
    "revision": null
  }, {
    "url": "assets/message-circle-kH4g6AY8.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-BF8NWgCu.js",
    "revision": null
  }, {
    "url": "assets/map-pin-CtxyVVuf.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-BvomUqwk.js",
    "revision": null
  }, {
    "url": "assets/layers-C6txzJ5V.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-CS8riV3j.js",
    "revision": null
  }, {
    "url": "assets/index-UOu_6y5i.js",
    "revision": null
  }, {
    "url": "assets/index-r1-wm3As.css",
    "revision": null
  }, {
    "url": "assets/index-D_tRLLyU.js",
    "revision": null
  }, {
    "url": "assets/index-Dv9m6rbH.js",
    "revision": null
  }, {
    "url": "assets/index-DrSw0tib.js",
    "revision": null
  }, {
    "url": "assets/index-Dq6yIwcE.js",
    "revision": null
  }, {
    "url": "assets/index-CTrZWjJe.js",
    "revision": null
  }, {
    "url": "assets/index-Ctc0kzV_.js",
    "revision": null
  }, {
    "url": "assets/index-CoPZWLT6.js",
    "revision": null
  }, {
    "url": "assets/index-CGS3p7Si.js",
    "revision": null
  }, {
    "url": "assets/index-C1KaEWqV.js",
    "revision": null
  }, {
    "url": "assets/index-b_rXtwl6.js",
    "revision": null
  }, {
    "url": "assets/index-BQeKwIFh.js",
    "revision": null
  }, {
    "url": "assets/index-9D18XOil.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-mnwH5DFw.js",
    "revision": null
  }, {
    "url": "assets/image-BKIHpICk.js",
    "revision": null
  }, {
    "url": "assets/history-BjD9dHqE.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-DcafbTmT.js",
    "revision": null
  }, {
    "url": "assets/gem-CNY_5Iol.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-BaV67CVR.js",
    "revision": null
  }, {
    "url": "assets/eye-DFAaexj4.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-DjEWHUpB.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-BQ5zeBWM.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-BQQVsgIN.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-DadvBBjX.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-DugcYIc_.js",
    "revision": null
  }, {
    "url": "assets/copy-CSMCCE0B.js",
    "revision": null
  }, {
    "url": "assets/Complete-CTgdHVLs.js",
    "revision": null
  }, {
    "url": "assets/circle-x-BBzDPNsh.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-DCeWlhwu.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-Ca28O0jZ.js",
    "revision": null
  }, {
    "url": "assets/camera-a0wwDVyr.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-zrMOQeQy.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-o6Ih1MiK.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2810063dbe097906fc5c63a9338b79d4"
  }, {
    "url": "pwa-192x192.png",
    "revision": "cea2092582875b3b1b81118c1ed40944"
  }, {
    "url": "pwa-512x512.png",
    "revision": "9d0a0d535c9c0e5d6add02fb4d607464"
  }, {
    "url": "splash-1640x2360.png",
    "revision": "2884ea3cad22e76a6677b975266afee3"
  }, {
    "url": "splash-1668x2388.png",
    "revision": "ef408097fa421b9bc7ecc243343a5d55"
  }, {
    "url": "splash-2048x2732.png",
    "revision": "4f5fbaae46ef9b372b8bf9ea5c56ae0c"
  }, {
    "url": "splash-2360x1640.png",
    "revision": "9c89644d2f776027e624a5ff5ece4536"
  }, {
    "url": "splash-2388x1668.png",
    "revision": "b6e20d1142c37078fa079a42dedf5d8d"
  }, {
    "url": "splash-2732x2048.png",
    "revision": "06e17fd99a987c8df22d62f1bbcd7d3e"
  }, {
    "url": "waschen.webp",
    "revision": "ddd1c5be5155ebf971d805c6db1eeb87"
  }, {
    "url": "manifest.webmanifest",
    "revision": "b458fece4be6f84cee6f57e6ad344045"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
