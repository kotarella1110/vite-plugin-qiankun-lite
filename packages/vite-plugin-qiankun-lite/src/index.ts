import { transformSync } from "@babel/core";
import { type Cheerio, type Element, load } from "cheerio";
import type { PluginOption, ResolvedConfig } from "vite";
import plugin from "./babel-plugin-transform-global-variables";

type Options = {
  name: string;
};

export default function viteQiankun(opts: Options): PluginOption {
  let config: ResolvedConfig;
  let publicPath = `(__QIANKUN_WINDOW__["${opts.name}"].__INJECTED_PUBLIC_PATH_BY_QIANKUN__ || "")`;
  return [
    {
      name: "qiankun:remain-exports",
      enforce: "post",
      apply: "build",
      options(options) {
        return {
          ...options,
          preserveEntrySignatures: "strict",
        };
      },
      transform(code, id) {
        if (id.endsWith("html") && this.getModuleInfo(id)?.isEntry) {
          return code.replace(/import/g, "export * from");
        }
        return null;
      },
    },
    {
      name: "qiankun:vite-module-script-transform",
      enforce: "post",
      apply: "serve",
      configureServer(server) {
        return () => {
          server.middlewares.use((_, res, next) => {
            if (config.isProduction) return next();

            const end = res.end.bind(res);
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            res.end = (...args: any[]) => {
              let [htmlStr, ...rest] = args;
              if (typeof htmlStr === "string") {
                const $ = load(htmlStr);
                moduleScriptToGeneralScript(
                  $($(`script[src=${config.base}@vite/client]`).get(0)),
                  publicPath,
                );
                const moduleScripts$ = $("script:not([src])[type=module]");
                moduleScripts$.each((_, moduleScript) => {
                  const moduleScript$ = $(moduleScript);
                  if (
                    moduleScript$
                      .text()
                      .includes(`${config.base}@react-refresh`)
                  ) {
                    reactRefreshModuleScriptToGeneralScript(
                      moduleScript$,
                      `${publicPath} + "${config.base}@react-refresh"`,
                    );
                  }
                });
                htmlStr = $.html();
              }
              return end(htmlStr, ...rest);
            };
            next();
          });
        };
      },
    },
    {
      name: "qiankun:support-proxy",
      enforce: "post",
      transform(code, id) {
        const filename = id.split("?")[0];
        const jsExts = [
          /\.[jt]sx?$/,
          /\.(m)?js?$/,
          /\.vue$/,
          /\.vue\?vue/,
          /\.svelte$/,
        ];
        if (
          !jsExts.some((reg) => reg.test(filename)) ||
          !/(document|window|globalThis|self)/g.test(code)
        )
          return code;

        return transformGlobalVariables(code, {
          replace: {
            ...Object.keys(config.define ?? []).reduce(
              (acc, key) => {
                acc[key] = `__QIANKUN_WINDOW__["${opts.name}"].${key}`;
                return acc;
              },
              {} as Record<string, string>,
            ),
            window: `__QIANKUN_WINDOW__["${opts.name}"]`,
          },
          addWindowPrefix: true,
        });
      },
    },
    {
      name: "qiankun:html-transform",
      enforce: "post",
      configResolved(resolvedConfig) {
        config = resolvedConfig;
        if (config.base) {
          publicPath = `${publicPath}.replace(${new RegExp(
            `${config.base}$`,
          )}, "")`;
        }
      },
      transformIndexHtml(html: string) {
        const $ = load(html);

        $("head").prepend(`
    <script>
      const nativeGlobal = Function("return this")();
      nativeGlobal.__QIANKUN_WINDOW__ = nativeGlobal.__QIANKUN_WINDOW__ || {};
      nativeGlobal.__QIANKUN_WINDOW__["${opts.name}"] = nativeGlobal.proxy || nativeGlobal;
    </script>
        `);

        const moduleTags = $(
          'body script[src][type=module], head script[src][crossorigin=""]',
        );
        if (!moduleTags || !moduleTags.length) {
          return;
        }
        moduleTags.each(
          (_, moduleTag) =>
            void moduleScriptToGeneralScript($(moduleTag), publicPath),
        );

        const script$ = moduleTags.last();
        script$?.html(`
      window["${opts.name}"] = {};
      const lifecycleNames = ["bootstrap", "mount", "unmount", "update"];
      ${script$.html()}.then((lifecycleHooks) => {
        lifecycleNames.forEach((lifecycleName) =>
          window["${opts.name}"][lifecycleName].resolve(
            lifecycleHooks[lifecycleName],
          ),
        );
      });
      lifecycleNames.forEach((lifecycleName) => {
        let resolve;
        const promise = new Promise((_resolve) => (resolve = _resolve));
        window["${opts.name}"][lifecycleName] = Object.assign(
          (...args) => promise.then((lifecycleHook) => lifecycleHook(...args)),
          { resolve },
        );
      });
    `);
        return $.html();
      },
    },
  ];
}

function transformGlobalVariables(
  code: string,
  options: Parameters<typeof plugin>[1],
) {
  const result = transformSync(code, {
    plugins: [[plugin, options]],
  });
  return result?.code;
}

function moduleScriptToGeneralScript(
  script$: Cheerio<Element>,
  publicPath: string,
) {
  const scriptSrc = script$.attr("src");
  if (!scriptSrc) return;
  script$
    .removeAttr("src")
    .removeAttr("type")
    .html(`import(${publicPath} + "${scriptSrc}")`);
  return script$;
}

function reactRefreshModuleScriptToGeneralScript(
  script$: Cheerio<Element>,
  reactRefreshImportPath: string,
) {
  script$.removeAttr("type").html(`
      ((window) => {
        import(${reactRefreshImportPath}).then(({ default: RefreshRuntime }) => {
          RefreshRuntime.injectIntoGlobalHook(window);
          window.$RefreshReg$ = () => {};
          window.$RefreshSig$ = () => (type) => type;
          window.__vite_plugin_react_preamble_installed__ = true;
        });
      })(new Function("return this")());
  `);
  return script$;
}
