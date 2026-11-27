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
    "revision": "a0e1754dac7ab9dea17891e2d0512760"
  }, {
    "url": "assets/zap-BzMFyn3d.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-CuNpm_Od.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/WhatsAppPhoneLink-BJhksVuP.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-CS6tf_2O.js",
    "revision": null
  }, {
    "url": "assets/upload-BRi8y7bY.js",
    "revision": null
  }, {
    "url": "assets/truck-BirDMbN8.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-BSJ3qSTX.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-DPRdfG5q.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-lnCLuPgw.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-BCwChkPM.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-BYNtreLw.js",
    "revision": null
  }, {
    "url": "assets/store-DVzG0LSZ.js",
    "revision": null
  }, {
    "url": "assets/sparkles-y-2p5SVJ.js",
    "revision": null
  }, {
    "url": "assets/shirt-I5Pj3Zo8.js",
    "revision": null
  }, {
    "url": "assets/send-BkA978Nm.js",
    "revision": null
  }, {
    "url": "assets/search-Qo9ukffu.js",
    "revision": null
  }, {
    "url": "assets/save-DzH6UePr.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-BiGfFHu4.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-BphG-hJP.js",
    "revision": null
  }, {
    "url": "assets/qr-code-DDikI7Ai.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-CUWBoagQ.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-DLI_o9ro.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-BowwfV6w.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-CjCuEU7_.js",
    "revision": null
  }, {
    "url": "assets/plus-CwL19NAh.js",
    "revision": null
  }, {
    "url": "assets/pen-line-DkXJRDTy.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-B0BgznrZ.js",
    "revision": null
  }, {
    "url": "assets/paperclip-Dweb3QUw.js",
    "revision": null
  }, {
    "url": "assets/package-DTDb958t.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-F2pyasKo.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-BB_Xuxl_.js",
    "revision": null
  }, {
    "url": "assets/message-circle-DYbXd4_I.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-CvDvixed.js",
    "revision": null
  }, {
    "url": "assets/map-pin-DTWHhcaw.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-BVNV3Jp8.js",
    "revision": null
  }, {
    "url": "assets/layers-Cv2fWDej.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-DoqTNfy_.js",
    "revision": null
  }, {
    "url": "assets/index-puX0W81N.js",
    "revision": null
  }, {
    "url": "assets/index-DZA3ityz.js",
    "revision": null
  }, {
    "url": "assets/index-Dco_ME1r.css",
    "revision": null
  }, {
    "url": "assets/index-Csy52NAa.js",
    "revision": null
  }, {
    "url": "assets/index-CROE6e_H.js",
    "revision": null
  }, {
    "url": "assets/index-CoKFNVnm.js",
    "revision": null
  }, {
    "url": "assets/index-Cf0cHhrA.js",
    "revision": null
  }, {
    "url": "assets/index-Ca51PdnM.js",
    "revision": null
  }, {
    "url": "assets/index-Bo75ff9g.js",
    "revision": null
  }, {
    "url": "assets/index-BL3P7OIG.js",
    "revision": null
  }, {
    "url": "assets/index-BkTiUAw6.js",
    "revision": null
  }, {
    "url": "assets/index-BFyz-NeS.js",
    "revision": null
  }, {
    "url": "assets/index-9ptd-nZ6.js",
    "revision": null
  }, {
    "url": "assets/index-81LpphnV.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-Dgisth1t.js",
    "revision": null
  }, {
    "url": "assets/image-TxYgzA-o.js",
    "revision": null
  }, {
    "url": "assets/history-CUQ6mSab.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-89cgkJF_.js",
    "revision": null
  }, {
    "url": "assets/gem-C3Y9oPTJ.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-fvywlqxE.js",
    "revision": null
  }, {
    "url": "assets/eye-BLUNgTB6.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-DdBJ28Tm.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-DB-AqemO.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-Gt-Sq7yL.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-3gBqdlXq.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-B1oR318k.js",
    "revision": null
  }, {
    "url": "assets/copy-DfTntU9c.js",
    "revision": null
  }, {
    "url": "assets/Complete-CLthu09O.js",
    "revision": null
  }, {
    "url": "assets/circle-x-Dte36iH9.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-DbKmxFIj.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-6Ju4QAz-.js",
    "revision": null
  }, {
    "url": "assets/camera-CtvjTRpP.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-CXnxHDxh.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-CQj_QRcO.js",
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
