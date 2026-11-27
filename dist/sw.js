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
    "revision": "1c4db64a76e44a136b4305ed8564a406"
  }, {
    "url": "assets/zap-BZ5reSbO.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-4kwR3ULB.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/WhatsAppPhoneLink-C8KiroXM.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-aErGffmR.js",
    "revision": null
  }, {
    "url": "assets/upload-BLpxtJzo.js",
    "revision": null
  }, {
    "url": "assets/truck-CkYskTgr.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-B2zhB6h-.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-DGRJowI6.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-DdeXLKoh.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-CLe_h3F_.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-CzhbXmlx.js",
    "revision": null
  }, {
    "url": "assets/store-VMJc2OxP.js",
    "revision": null
  }, {
    "url": "assets/sparkles-Sv2GRXqF.js",
    "revision": null
  }, {
    "url": "assets/shirt-CxMMl17L.js",
    "revision": null
  }, {
    "url": "assets/send-B7hSMIti.js",
    "revision": null
  }, {
    "url": "assets/search-D6zrzTrw.js",
    "revision": null
  }, {
    "url": "assets/save-ziYm5NM_.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-D4_ofand.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-F1y9RjLe.js",
    "revision": null
  }, {
    "url": "assets/qr-code-CNBzlF9K.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-u8CGyv1D.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-CD-nZgl-.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-CXi_4EXr.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-1voIs8gc.js",
    "revision": null
  }, {
    "url": "assets/plus-DoxAch-t.js",
    "revision": null
  }, {
    "url": "assets/pen-line-CPQJA0Ay.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-B1nMo2iX.js",
    "revision": null
  }, {
    "url": "assets/paperclip-8guNbUzJ.js",
    "revision": null
  }, {
    "url": "assets/package-Bx0iFor2.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-C-jFhrno.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-fJOo7wFI.js",
    "revision": null
  }, {
    "url": "assets/message-circle-BHmSPjYS.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-DexFrqoq.js",
    "revision": null
  }, {
    "url": "assets/map-pin-CbI_vqjH.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-Dg4pYXzb.js",
    "revision": null
  }, {
    "url": "assets/layers--Ffjvkcv.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-BATqO-OQ.js",
    "revision": null
  }, {
    "url": "assets/index-XM4UiP5b.js",
    "revision": null
  }, {
    "url": "assets/index-KTvdUfC4.css",
    "revision": null
  }, {
    "url": "assets/index-ivfe1Tk1.js",
    "revision": null
  }, {
    "url": "assets/index-D_xBu9zS.js",
    "revision": null
  }, {
    "url": "assets/index-Dji_R3C1.js",
    "revision": null
  }, {
    "url": "assets/index-CuzM3c-3.js",
    "revision": null
  }, {
    "url": "assets/index-CsDvGA-n.js",
    "revision": null
  }, {
    "url": "assets/index-BZ1oprW9.js",
    "revision": null
  }, {
    "url": "assets/index-ByXJ-j5U.js",
    "revision": null
  }, {
    "url": "assets/index-BSwp_Wao.js",
    "revision": null
  }, {
    "url": "assets/index-BQKpfIV-.js",
    "revision": null
  }, {
    "url": "assets/index-BHdt65Gs.js",
    "revision": null
  }, {
    "url": "assets/index-BDmDB15Q.js",
    "revision": null
  }, {
    "url": "assets/index-B8DBPgMo.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-Er0IjdOy.js",
    "revision": null
  }, {
    "url": "assets/image-D2UARHBp.js",
    "revision": null
  }, {
    "url": "assets/history-CyZ6qD3A.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-BIyWHbe_.js",
    "revision": null
  }, {
    "url": "assets/gem-zt3KwIgg.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-DzXTrev_.js",
    "revision": null
  }, {
    "url": "assets/eye-14XHJRuR.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-BFjXM09I.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-CMK1yAq2.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-wuO1mScw.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-DSGOVBZB.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-Dhw9ivOw.js",
    "revision": null
  }, {
    "url": "assets/copy-KTRWq7jE.js",
    "revision": null
  }, {
    "url": "assets/Complete-D77BcerF.js",
    "revision": null
  }, {
    "url": "assets/circle-x-DEXauejB.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-BneLjSvy.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-Dy3AgE2g.js",
    "revision": null
  }, {
    "url": "assets/camera-ySfFuWkD.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-B0Q4_F8J.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-BYwapr6f.js",
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
