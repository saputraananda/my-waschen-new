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
    "revision": "5cca7936603134b4bfe22bc456469eac"
  }, {
    "url": "assets/zap-D0SX6dUb.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-DEcJJZZ3.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/WhatsAppPhoneLink-DAHLWhaX.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-CU7O6TOw.js",
    "revision": null
  }, {
    "url": "assets/upload-BD71p-c0.js",
    "revision": null
  }, {
    "url": "assets/truck-BO75dgO4.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-DGnLaqE3.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-DvNN7v80.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-BL1eO9ru.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-DfTKCjXA.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-D8FhIpcF.js",
    "revision": null
  }, {
    "url": "assets/store-_iRLwkEO.js",
    "revision": null
  }, {
    "url": "assets/sparkles-BR5-xVuY.js",
    "revision": null
  }, {
    "url": "assets/shirt-BPIV5HgJ.js",
    "revision": null
  }, {
    "url": "assets/send-Be7tlehU.js",
    "revision": null
  }, {
    "url": "assets/search-CelPvYal.js",
    "revision": null
  }, {
    "url": "assets/save-C-mm7CAg.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-CrJsEvXI.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-BaqeDrYu.js",
    "revision": null
  }, {
    "url": "assets/qr-code-C6nBmA8s.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-BiODSuU3.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-CZMIaDxt.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-BJcf95gT.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-CJ_l4ByK.js",
    "revision": null
  }, {
    "url": "assets/plus-CD5TGzCt.js",
    "revision": null
  }, {
    "url": "assets/pen-line-D6UhTNLt.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-Xs4LF0BD.js",
    "revision": null
  }, {
    "url": "assets/paperclip-BzAr9u88.js",
    "revision": null
  }, {
    "url": "assets/package-Cug3lKeV.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-D_tVnH54.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-Dqanj6FL.js",
    "revision": null
  }, {
    "url": "assets/message-circle-DCoZlVSf.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-CepKJ-Vt.js",
    "revision": null
  }, {
    "url": "assets/map-pin-22KmDQ5y.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-CYDu7R6P.js",
    "revision": null
  }, {
    "url": "assets/layers-uOY6npls.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-k5KeVjAx.js",
    "revision": null
  }, {
    "url": "assets/index-vtrypouL.js",
    "revision": null
  }, {
    "url": "assets/index-UUOzVS36.js",
    "revision": null
  }, {
    "url": "assets/index-PI9Souqo.js",
    "revision": null
  }, {
    "url": "assets/index-o6wQV6Vf.js",
    "revision": null
  }, {
    "url": "assets/index-KaDr7kf3.js",
    "revision": null
  }, {
    "url": "assets/index-DtXlZ4kK.js",
    "revision": null
  }, {
    "url": "assets/index-DTbLcMOt.js",
    "revision": null
  }, {
    "url": "assets/index-Dco_ME1r.css",
    "revision": null
  }, {
    "url": "assets/index-CzT760sk.js",
    "revision": null
  }, {
    "url": "assets/index-CZ-kzxxF.js",
    "revision": null
  }, {
    "url": "assets/index-CScB-e3C.js",
    "revision": null
  }, {
    "url": "assets/index-C0wjjPjE.js",
    "revision": null
  }, {
    "url": "assets/index-B5BXL6-_.js",
    "revision": null
  }, {
    "url": "assets/index-1UBDv2MU.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-sucDnAbF.js",
    "revision": null
  }, {
    "url": "assets/image-Drn_r_w5.js",
    "revision": null
  }, {
    "url": "assets/history-cVgw5fY2.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-CfCaw_Fj.js",
    "revision": null
  }, {
    "url": "assets/gem-BU82Tolx.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-B9bwxs86.js",
    "revision": null
  }, {
    "url": "assets/eye-Daw8jhOm.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-zH8fah1F.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-1Df_MTJ5.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-CIqF0SxL.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-Bnkvl8Mx.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-CsYaoO7E.js",
    "revision": null
  }, {
    "url": "assets/copy-DIDYJQOi.js",
    "revision": null
  }, {
    "url": "assets/Complete-Z47TR_pV.js",
    "revision": null
  }, {
    "url": "assets/circle-x-BVTM26Ue.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-DRp0hww3.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-CbEMEzXg.js",
    "revision": null
  }, {
    "url": "assets/camera-BIhJgBDw.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-B1ePqpgr.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-CMQB9AoX.js",
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
