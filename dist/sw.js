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
    "revision": "57bebf7b09d95e5d233d68ad2cc4be44"
  }, {
    "url": "assets/zap-xIssc0KR.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-DAESNdtO.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-BF5Zghyw.js",
    "revision": null
  }, {
    "url": "assets/upload-BOLpyvk1.js",
    "revision": null
  }, {
    "url": "assets/truck-CJzerprl.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-DpJPfQ6A.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-Bj7Y8_Bc.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-zNDNUiUS.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-D8Qbjw48.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-Bf-SBg_N.js",
    "revision": null
  }, {
    "url": "assets/store-mJgRXM6J.js",
    "revision": null
  }, {
    "url": "assets/sparkles-C6iAz8xr.js",
    "revision": null
  }, {
    "url": "assets/shirt-mUirBOrL.js",
    "revision": null
  }, {
    "url": "assets/send-DdHMhq4N.js",
    "revision": null
  }, {
    "url": "assets/search-DEiZXyAw.js",
    "revision": null
  }, {
    "url": "assets/save-CFyyhl4w.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-CTKpj-OV.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-Bca0HYfD.js",
    "revision": null
  }, {
    "url": "assets/qr-code-DmDOnguP.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-R5B4mSr0.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-BOJmP-sx.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-DO2PU5i8.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-D3hTRnYH.js",
    "revision": null
  }, {
    "url": "assets/plus-79i4uPjK.js",
    "revision": null
  }, {
    "url": "assets/pen-line-DoRe_dFE.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-DoGDHLW4.js",
    "revision": null
  }, {
    "url": "assets/paperclip-DFCg5KLP.js",
    "revision": null
  }, {
    "url": "assets/package-EVAoiRvJ.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-CjHikwyC.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-DfuP85NA.js",
    "revision": null
  }, {
    "url": "assets/message-circle-B1xTmb_E.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-B-t6mmiZ.js",
    "revision": null
  }, {
    "url": "assets/map-pin-zI3_NyzI.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-KSZUakoF.js",
    "revision": null
  }, {
    "url": "assets/layers-CZ40_XFb.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-BlE2p7RZ.js",
    "revision": null
  }, {
    "url": "assets/index-r1-wm3As.css",
    "revision": null
  }, {
    "url": "assets/index-Dvo1qwaO.js",
    "revision": null
  }, {
    "url": "assets/index-DJD2klSa.js",
    "revision": null
  }, {
    "url": "assets/index-DbqQK3SH.js",
    "revision": null
  }, {
    "url": "assets/index-D6yq1f61.js",
    "revision": null
  }, {
    "url": "assets/index-Cy8lgYyj.js",
    "revision": null
  }, {
    "url": "assets/index-CumOaROe.js",
    "revision": null
  }, {
    "url": "assets/index-CSzvZ5dV.js",
    "revision": null
  }, {
    "url": "assets/index-CD-Pd8ai.js",
    "revision": null
  }, {
    "url": "assets/index-ByZROvYd.js",
    "revision": null
  }, {
    "url": "assets/index-BrxbSPV2.js",
    "revision": null
  }, {
    "url": "assets/index-BklD-yVf.js",
    "revision": null
  }, {
    "url": "assets/index-akuzYlKb.js",
    "revision": null
  }, {
    "url": "assets/index-0O46gAV9.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-Y4u4Yeon.js",
    "revision": null
  }, {
    "url": "assets/image-PYcDXYqD.js",
    "revision": null
  }, {
    "url": "assets/history-BGPEAmeQ.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-CY51Oy1R.js",
    "revision": null
  }, {
    "url": "assets/gem-BEq0Lnm-.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-C3Upqchg.js",
    "revision": null
  }, {
    "url": "assets/eye-DObLBw-O.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-g66mbiIG.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-5mCBMfRF.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-Bsa7KCF6.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-ZeKEbku0.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-CKBypgQD.js",
    "revision": null
  }, {
    "url": "assets/copy-Dpcd-fgC.js",
    "revision": null
  }, {
    "url": "assets/Complete-Bo1MiTrJ.js",
    "revision": null
  }, {
    "url": "assets/circle-x-BdDwlJPT.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-BRM0t7XO.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-DNpg4fwo.js",
    "revision": null
  }, {
    "url": "assets/camera-BjKCB4zu.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-UyRHIQcM.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-5xc1VBqY.js",
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
