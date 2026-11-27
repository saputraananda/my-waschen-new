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
    "revision": "b7fb589198f3f00c6bd47c5fcc798bbc"
  }, {
    "url": "assets/zap-D_K8JLow.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-B57yZVbm.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-DMzgfL0c.js",
    "revision": null
  }, {
    "url": "assets/upload-BiPpkZwe.js",
    "revision": null
  }, {
    "url": "assets/truck-B46SvJzm.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-CyHH28tB.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-BECr1DNh.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-CmhIRg4W.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-CzWDr3IJ.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-fm7L_z4W.js",
    "revision": null
  }, {
    "url": "assets/store-BZjTJSmx.js",
    "revision": null
  }, {
    "url": "assets/sparkles-HWNq-bWk.js",
    "revision": null
  }, {
    "url": "assets/shirt-_vZ-YwiJ.js",
    "revision": null
  }, {
    "url": "assets/send-loVvgRo_.js",
    "revision": null
  }, {
    "url": "assets/search-DkPfdzvH.js",
    "revision": null
  }, {
    "url": "assets/save-CgGROTXQ.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-nibbG9R4.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-qsl9GNYh.js",
    "revision": null
  }, {
    "url": "assets/qr-code-BYOF9_-W.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-BeAt5a4u.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-D6WFQwAL.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-cHlOYWbO.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-hPwNLGhW.js",
    "revision": null
  }, {
    "url": "assets/plus-B8UoMhV2.js",
    "revision": null
  }, {
    "url": "assets/pen-line-DUNWYX9f.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-BaB9c0UH.js",
    "revision": null
  }, {
    "url": "assets/paperclip-D0YLvb3z.js",
    "revision": null
  }, {
    "url": "assets/package-BBWX_xT6.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-BiKSjXlX.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-PYbmgixk.js",
    "revision": null
  }, {
    "url": "assets/message-circle-FM7-Iir-.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-CclYS5F1.js",
    "revision": null
  }, {
    "url": "assets/map-pin-Bl37ZMbX.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-DSQMHS2J.js",
    "revision": null
  }, {
    "url": "assets/layers-i68InbPP.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-B3V1Ev_o.js",
    "revision": null
  }, {
    "url": "assets/index-VSVpoaAk.js",
    "revision": null
  }, {
    "url": "assets/index-r1-wm3As.css",
    "revision": null
  }, {
    "url": "assets/index-DZaO_g8T.js",
    "revision": null
  }, {
    "url": "assets/index-DmrNBlY6.js",
    "revision": null
  }, {
    "url": "assets/index-DlWK97Ff.js",
    "revision": null
  }, {
    "url": "assets/index-Dk3GB4od.js",
    "revision": null
  }, {
    "url": "assets/index-D-jWCP34.js",
    "revision": null
  }, {
    "url": "assets/index-BzqWZwLV.js",
    "revision": null
  }, {
    "url": "assets/index-Bwfwzr8r.js",
    "revision": null
  }, {
    "url": "assets/index-BUXVOIZM.js",
    "revision": null
  }, {
    "url": "assets/index-BNbKBW5s.js",
    "revision": null
  }, {
    "url": "assets/index-BCxGjH8E.js",
    "revision": null
  }, {
    "url": "assets/index-9ymuqxPr.js",
    "revision": null
  }, {
    "url": "assets/index-6HNT1xfw.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-BjxBqQjW.js",
    "revision": null
  }, {
    "url": "assets/image-Bv0Cb39G.js",
    "revision": null
  }, {
    "url": "assets/history-XwQrqpGF.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-UL-Fge35.js",
    "revision": null
  }, {
    "url": "assets/gem-CWsw7jWy.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-CYVEOcKh.js",
    "revision": null
  }, {
    "url": "assets/eye-D7utwDsf.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-rX4lrBqW.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-BrOlciUH.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-CkwkgWK7.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-D2kA1kU3.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-CEJNSEva.js",
    "revision": null
  }, {
    "url": "assets/copy-C7i77Lqt.js",
    "revision": null
  }, {
    "url": "assets/Complete-ByeHUTB7.js",
    "revision": null
  }, {
    "url": "assets/circle-x-B4TUNo5N.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-DGPsY1Mj.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-Oh56C-5U.js",
    "revision": null
  }, {
    "url": "assets/camera-glmVRngI.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-CgUjA8o8.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-a46-qu3O.js",
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
