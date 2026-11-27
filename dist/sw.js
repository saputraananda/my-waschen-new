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
    "revision": "c8710d347774a2085c78ca7caa45ff4c"
  }, {
    "url": "assets/zap-CWZ4tKog.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-0A3M41kR.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/WhatsAppPhoneLink-BvM89hxl.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-DLX-Lbxe.js",
    "revision": null
  }, {
    "url": "assets/upload-ByJ8C6QA.js",
    "revision": null
  }, {
    "url": "assets/truck-L-2OnvQD.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-Dr96OQTA.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-1EzZC9WW.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-BBPMfYPq.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-B2WOKdbp.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-DTJ-af2P.js",
    "revision": null
  }, {
    "url": "assets/store-Bjuhe6HC.js",
    "revision": null
  }, {
    "url": "assets/sparkles-CoxUiMRb.js",
    "revision": null
  }, {
    "url": "assets/shirt-HB42lnO_.js",
    "revision": null
  }, {
    "url": "assets/send-CXBx_Ctz.js",
    "revision": null
  }, {
    "url": "assets/search-Cm3KcO_r.js",
    "revision": null
  }, {
    "url": "assets/save-tRvQBVt8.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-Be0RwHjU.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-DX1sJCYW.js",
    "revision": null
  }, {
    "url": "assets/qr-code-CkiBmSw-.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-B4ov7LRC.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-B_2xAk79.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-7vtMa_Iw.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-CKEh6222.js",
    "revision": null
  }, {
    "url": "assets/plus-ul2_xydk.js",
    "revision": null
  }, {
    "url": "assets/pen-line-DKBeoXIZ.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-4r1vs_a4.js",
    "revision": null
  }, {
    "url": "assets/paperclip-B3yFjavh.js",
    "revision": null
  }, {
    "url": "assets/package-BDV1q9CH.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-DBs9TkYn.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-MLSq4KZr.js",
    "revision": null
  }, {
    "url": "assets/message-circle-BqLBaFq2.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-CeqrdV7E.js",
    "revision": null
  }, {
    "url": "assets/map-pin-Crt6M2xc.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-D6MJucdX.js",
    "revision": null
  }, {
    "url": "assets/layers-D8CFw5Hf.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-ZhQ36at2.js",
    "revision": null
  }, {
    "url": "assets/index-Tk4XwyDG.js",
    "revision": null
  }, {
    "url": "assets/index-SH4og0FE.js",
    "revision": null
  }, {
    "url": "assets/index-KTvdUfC4.css",
    "revision": null
  }, {
    "url": "assets/index-EdHaY1MZ.js",
    "revision": null
  }, {
    "url": "assets/index-DXhzs8gx.js",
    "revision": null
  }, {
    "url": "assets/index-DgVUcg1p.js",
    "revision": null
  }, {
    "url": "assets/index-CqsNBTm7.js",
    "revision": null
  }, {
    "url": "assets/index-Cmops_NW.js",
    "revision": null
  }, {
    "url": "assets/index-ChH7ifJ7.js",
    "revision": null
  }, {
    "url": "assets/index-Cdiq0fr5.js",
    "revision": null
  }, {
    "url": "assets/index-BSaHblvQ.js",
    "revision": null
  }, {
    "url": "assets/index-Brpft4DL.js",
    "revision": null
  }, {
    "url": "assets/index-BK-qYEhg.js",
    "revision": null
  }, {
    "url": "assets/index-B-pr5Afp.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-BDH4OaBL.js",
    "revision": null
  }, {
    "url": "assets/image-BaeeZ8YF.js",
    "revision": null
  }, {
    "url": "assets/history--Ld3YhIe.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-BGhyrZJr.js",
    "revision": null
  }, {
    "url": "assets/gem-C1G9MWi_.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-D2mrfvMy.js",
    "revision": null
  }, {
    "url": "assets/eye-4Fai5-lg.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-CLx5cJGp.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-Dx9ND3Wr.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-C-FDLGJ3.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-ZuWJgB9p.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-Br6gGSnT.js",
    "revision": null
  }, {
    "url": "assets/copy-Dlr01Q5M.js",
    "revision": null
  }, {
    "url": "assets/Complete-DeV10MAs.js",
    "revision": null
  }, {
    "url": "assets/circle-x-CGRvDp1L.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-C6ZW6WLg.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-Dpo0pJ-M.js",
    "revision": null
  }, {
    "url": "assets/camera-BSCYs7v6.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-CL5d2NcY.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-gt6NKunf.js",
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
