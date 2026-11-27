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
    "revision": "2dedf5c73dd058101384d7d0657921dc"
  }, {
    "url": "assets/zap-a2zJgOA3.js",
    "revision": null
  }, {
    "url": "assets/workStatusMeta-BCrxkmyF.js",
    "revision": null
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/waschen_white-ClE-tgHn.js",
    "revision": null
  }, {
    "url": "assets/useNetworkRestored-B2IhfzSt.js",
    "revision": null
  }, {
    "url": "assets/upload-7XWglrCF.js",
    "revision": null
  }, {
    "url": "assets/truck-C2lSZd-m.js",
    "revision": null
  }, {
    "url": "assets/TransactionBarcodeCard-DcKgYtdD.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaMerge-zFT_grS4.js",
    "revision": null
  }, {
    "url": "assets/ThermalNotaBody-5FIcCxTK.js",
    "revision": null
  }, {
    "url": "assets/ThermalNota-C1ReRtiB.js",
    "revision": null
  }, {
    "url": "assets/TablePagination-CZ03lNar.js",
    "revision": null
  }, {
    "url": "assets/store-DLT-QwfF.js",
    "revision": null
  }, {
    "url": "assets/sparkles-BMjZjssI.js",
    "revision": null
  }, {
    "url": "assets/shirt-CPqVIlRL.js",
    "revision": null
  }, {
    "url": "assets/send-qAgfIZPs.js",
    "revision": null
  }, {
    "url": "assets/search-DZbAU2rv.js",
    "revision": null
  }, {
    "url": "assets/save-mjzqbDWx.js",
    "revision": null
  }, {
    "url": "assets/rotate-ccw-2FUVmt65.js",
    "revision": null
  }, {
    "url": "assets/refresh-ccw-Df7NUxAh.js",
    "revision": null
  }, {
    "url": "assets/qr-code-CqGasA1e.js",
    "revision": null
  }, {
    "url": "assets/QCFrontDeliv-CU0jE_QY.js",
    "revision": null
  }, {
    "url": "assets/QcCameraModal-C6Htdec9.js",
    "revision": null
  }, {
    "url": "assets/ProofFilePreview-dFOSFA3B.js",
    "revision": null
  }, {
    "url": "assets/PrinterSettings-Cfbpkt34.js",
    "revision": null
  }, {
    "url": "assets/plus-BUQffzIg.js",
    "revision": null
  }, {
    "url": "assets/pen-line-DYEshD4G.js",
    "revision": null
  }, {
    "url": "assets/PaymentProofFields-BE9zO08z.js",
    "revision": null
  }, {
    "url": "assets/paperclip-ChDuPNkD.js",
    "revision": null
  }, {
    "url": "assets/package-BuCPYvxt.js",
    "revision": null
  }, {
    "url": "assets/NormalizePhone-6LR9wraA.js",
    "revision": null
  }, {
    "url": "assets/ModalLacakNota-BSTxADQB.js",
    "revision": null
  }, {
    "url": "assets/message-circle-Dwjx_f63.js",
    "revision": null
  }, {
    "url": "assets/maximize-2-BQj5C2pl.js",
    "revision": null
  }, {
    "url": "assets/map-pin-B7JejOUi.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-DXd5UqBr.js",
    "revision": null
  }, {
    "url": "assets/layers-BXUajE18.js",
    "revision": null
  }, {
    "url": "assets/ItemPhotosField-KK2p5LKP.js",
    "revision": null
  }, {
    "url": "assets/index-UFd7a5O7.js",
    "revision": null
  }, {
    "url": "assets/index-r1-wm3As.css",
    "revision": null
  }, {
    "url": "assets/index-efHR195a.js",
    "revision": null
  }, {
    "url": "assets/index-DtIzR9GB.js",
    "revision": null
  }, {
    "url": "assets/index-DOe0IFrv.js",
    "revision": null
  }, {
    "url": "assets/index-DjGXWF3_.js",
    "revision": null
  }, {
    "url": "assets/index-DesX2RuI.js",
    "revision": null
  }, {
    "url": "assets/index-DcKPX_h_.js",
    "revision": null
  }, {
    "url": "assets/index-DaLc8LEQ.js",
    "revision": null
  }, {
    "url": "assets/index-D-ed6Dyo.js",
    "revision": null
  }, {
    "url": "assets/index-CQ9C5WVS.js",
    "revision": null
  }, {
    "url": "assets/index-CoClafka.js",
    "revision": null
  }, {
    "url": "assets/index-CnhS5bTq.js",
    "revision": null
  }, {
    "url": "assets/index-CeoFpmnK.js",
    "revision": null
  }, {
    "url": "assets/ImageLightbox-Efm5YTMv.js",
    "revision": null
  }, {
    "url": "assets/image-B9cf0DEt.js",
    "revision": null
  }, {
    "url": "assets/history-Dzyt8-To.js",
    "revision": null
  }, {
    "url": "assets/HeaderNav-CV030Dqu.js",
    "revision": null
  }, {
    "url": "assets/gem-DBGQLhH0.js",
    "revision": null
  }, {
    "url": "assets/FilterDate-B8lV9QgO.js",
    "revision": null
  }, {
    "url": "assets/eye-CiQVcC1g.js",
    "revision": null
  }, {
    "url": "assets/extractOrderNo-6TnXKoW8.js",
    "revision": null
  }, {
    "url": "assets/exceljs.min-BscDUqyj.js",
    "revision": null
  }, {
    "url": "assets/DetailTransaction-CUSualzr.js",
    "revision": null
  }, {
    "url": "assets/DateModeFilter-abB2FOzS.js",
    "revision": null
  }, {
    "url": "assets/customerPickLabel-DlS90nUe.js",
    "revision": null
  }, {
    "url": "assets/credit-card-ByI9zIz1.js",
    "revision": null
  }, {
    "url": "assets/copy-Du5rNcOM.js",
    "revision": null
  }, {
    "url": "assets/Complete-y30JCr9i.js",
    "revision": null
  }, {
    "url": "assets/circle-x-BR57f3kV.js",
    "revision": null
  }, {
    "url": "assets/circle-pause-NxjAna1C.js",
    "revision": null
  }, {
    "url": "assets/chevron-left-BcSQRwcl.js",
    "revision": null
  }, {
    "url": "assets/camera-CbCVpN3Z.js",
    "revision": null
  }, {
    "url": "assets/calendar-days-CatXYIFE.js",
    "revision": null
  }, {
    "url": "assets/BackdatePaymentField-BC_atjEN.js",
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
