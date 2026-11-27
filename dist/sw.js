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
    "revision": "ca09ef078165a775a9680b0405fe27b7"
  }, {
    "url": "assets/zap-CHSdQtLh.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-CsnsxoC5.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-ib0R7oHt.js",
    "revision": null
  }, {
    "url": "assets/upload-BMNYNu3w.js",
    "revision": null
  }, {
    "url": "assets/truck-D5k39Biu.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-DQFCszn1.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-Bno2K4Z5.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-SlcIuzLY.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-_0akugNo.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-R-Ury2ZB.js",
    "revision": null
  }, {
    "url": "assets/store-DNVt3BzK.js",
    "revision": null
  }, {
    "url": "assets/sparkles-CRZea4fp.js",
    "revision": null
  }, {
    "url": "assets/shirt-B9NOH4d_.js",
    "revision": null
  }, {
    "url": "assets/send-BDUbJOVe.js",
    "revision": null
  }, {
    "url": "assets/search-CEaVear5.js",
    "revision": null
  }, {
    "url": "assets/save-DmlF4n4J.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-BCRkZKJK.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-QogLnZ_a.js",
    "revision": null
  }, {
    "url": "assets/qr-code-BQWx3bub.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-BPxLR6Zo.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-Bwwyp1n-.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-CkdjouR9.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-Nf_ElLty.js",
    "revision": null
  }, {
    "url": "assets/plus-DVW9miIg.js",
    "revision": null
  }, {
    "url": "assets/pen-line-C1qVZS0P.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-CoBYSCT4.js",
    "revision": null
  }, {
    "url": "assets/paperclip-CtuBx7jJ.js",
    "revision": null
  }, {
    "url": "assets/package-BQxeMwAW.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-7Dg2Mq-7.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-D2FGHS3m.js",
    "revision": null
  }, {
    "url": "assets/message-circle-BMvmQRvB.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-CKg1KNpw.js",
    "revision": null
  }, {
    "url": "assets/map-pin-BAeK_sFx.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-Cg6giSAC.js",
    "revision": null
  }, {
    "url": "assets/layers-DMQyQU5E.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-FR4zhp1Z.js",
    "revision": null
  }, {
    "url": "assets/index-r1-wm3As.css",
    "revision": null
  }, {
    "url": "assets/index-MZyBUpQh.js",
    "revision": null
  }, {
    "url": "assets/index-MKqRcrk3.js",
    "revision": null
  }, {
    "url": "assets/index-DZbFpFj1.js",
    "revision": null
  }, {
    "url": "assets/index-DXFM3n5M.js",
    "revision": null
  }, {
    "url": "assets/index-DSt-VNJZ.js",
    "revision": null
  }, {
    "url": "assets/index-Dss_cXJx.js",
    "revision": null
  }, {
    "url": "assets/index-DSp4klyZ.js",
    "revision": null
  }, {
    "url": "assets/index-Dqrt3Npi.js",
    "revision": null
  }, {
    "url": "assets/index-CD--F3rO.js",
    "revision": null
  }, {
    "url": "assets/index-BoB_Ihyz.js",
    "revision": null
  }, {
    "url": "assets/index-BKMOrkQW.js",
    "revision": null
  }, {
    "url": "assets/index-BfBNloFK.js",
    "revision": null
  }, {
    "url": "assets/index-B0-GK2-i.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-BZHQMnvq.js",
    "revision": null
  }, {
    "url": "assets/image-Bx3AkMBE.js",
    "revision": null
  }, {
    "url": "assets/history-Cf7j5VJG.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-PEi_Dd4Z.js",
    "revision": null
  }, {
    "url": "assets/gem-DcqVYf0C.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-DtRnCT8j.js",
    "revision": null
  }, {
    "url": "assets/eye-y64jYCKT.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-BbsHE3-v.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-BVylh6mi.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-BgkXuMfQ.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-K4wj9qDt.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-BvlDg_OU.js",
    "revision": null
  }, {
    "url": "assets/copy-H2L_akGW.js",
    "revision": null
  }, {
    "url": "assets/Complete-AbR8XN_V.js",
    "revision": null
  }, {
    "url": "assets/circle-x-CMaS_FbW.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-C5TAQa_g.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-C3-aIoat.js",
    "revision": null
  }, {
    "url": "assets/camera-BD0NEwhD.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-wAYZmcTS.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-VpfiKw9V.js",
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
