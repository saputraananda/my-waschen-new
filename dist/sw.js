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
    "revision": "68abcba621308462929058b6f3c77887"
  }, {
    "url": "assets/zap-Bjq5I3YP.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-YrME1hnk.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-D34Awwcv.js",
    "revision": null
  }, {
    "url": "assets/upload-DrEM82Xl.js",
    "revision": null
  }, {
    "url": "assets/truck-6zVullcJ.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-BtusuhtI.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-DPljrPHB.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-C_OWLohS.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-ReKRmN4n.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-ER9gNc1f.js",
    "revision": null
  }, {
    "url": "assets/store-BVqbbThH.js",
    "revision": null
  }, {
    "url": "assets/sparkles-NgemsKoK.js",
    "revision": null
  }, {
    "url": "assets/shirt-DMHLY9vq.js",
    "revision": null
  }, {
    "url": "assets/send-cBcDgjMv.js",
    "revision": null
  }, {
    "url": "assets/search-DoBG_OjX.js",
    "revision": null
  }, {
    "url": "assets/save-CLd27Eb4.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-Dr6oufXa.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-TwoHv4gQ.js",
    "revision": null
  }, {
    "url": "assets/qr-code-YyGWOCiH.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-CmzwYbGs.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-DyBrBj_N.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-Bbf0WlHK.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-CWuOSu1K.js",
    "revision": null
  }, {
    "url": "assets/plus-BHyc5GWj.js",
    "revision": null
  }, {
    "url": "assets/pen-line-BRpjM3jL.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-uKRAXuAz.js",
    "revision": null
  }, {
    "url": "assets/paperclip-CzU5QlSd.js",
    "revision": null
  }, {
    "url": "assets/package-BzZETfbs.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-Be3yhJJc.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-BZpMoRm6.js",
    "revision": null
  }, {
    "url": "assets/message-circle-CtXSfReu.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-Cs-3vDr5.js",
    "revision": null
  }, {
    "url": "assets/map-pin-CS5UZCO_.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-aMd91DNn.js",
    "revision": null
  }, {
    "url": "assets/layers-XUKvSBgb.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-DceBgPcU.js",
    "revision": null
  }, {
    "url": "assets/index-_b1X-bSV.js",
    "revision": null
  }, {
    "url": "assets/index-WyspWudo.js",
    "revision": null
  }, {
    "url": "assets/index-uz6qoyHx.js",
    "revision": null
  }, {
    "url": "assets/index-r1-wm3As.css",
    "revision": null
  }, {
    "url": "assets/index-n9d2_L_b.js",
    "revision": null
  }, {
    "url": "assets/index-DzwODVGI.js",
    "revision": null
  }, {
    "url": "assets/index-Dc25rylS.js",
    "revision": null
  }, {
    "url": "assets/index-d618SjkJ.js",
    "revision": null
  }, {
    "url": "assets/index-CVJmgjiS.js",
    "revision": null
  }, {
    "url": "assets/index-CORfSjQ1.js",
    "revision": null
  }, {
    "url": "assets/index-CDllUemD.js",
    "revision": null
  }, {
    "url": "assets/index-BVzMYvRB.js",
    "revision": null
  }, {
    "url": "assets/index-BN0FYxkQ.js",
    "revision": null
  }, {
    "url": "assets/index-BLhnxrVE.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-IMvmJx5W.js",
    "revision": null
  }, {
    "url": "assets/image-DOi7CSjE.js",
    "revision": null
  }, {
    "url": "assets/history-DYIglQW7.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-B0YIW59D.js",
    "revision": null
  }, {
    "url": "assets/gem-DqvMFOEf.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-CCO9HnRn.js",
    "revision": null
  }, {
    "url": "assets/eye-k1QurqyI.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-IusJ_wLn.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-DXZBGT_t.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-CdiB0Gzx.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-BNN_xGF0.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-CTlM7kb1.js",
    "revision": null
  }, {
    "url": "assets/copy-BYQ9NTsL.js",
    "revision": null
  }, {
    "url": "assets/Complete-BcQbJfNy.js",
    "revision": null
  }, {
    "url": "assets/circle-x-DEjFnTvT.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-Bg43ih28.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-Cxf79uRv.js",
    "revision": null
  }, {
    "url": "assets/camera-e_YLR1FH.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-BUkfP84x.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-DGQiTpCW.js",
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
