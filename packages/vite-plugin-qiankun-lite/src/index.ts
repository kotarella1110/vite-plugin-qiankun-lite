import { transformAsync } from "@babel/core";
import { type Cheerio, type Element, load } from "cheerio";
import type { PluginOption, ResolvedConfig } from "vite";
import htmlPluginOrg from "vite-plugin-index-html";
import plugin from "./babel-plugin-transform-global-variables";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const createHtmlPlugin: typeof htmlPluginOrg = (htmlPluginOrg as any).default
  ? // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (htmlPluginOrg as any).default
  : htmlPluginOrg;

type Options = {
  name: string;
  entry: string;
  sandbox?: boolean;
};

export default function viteQiankun(opts: Options): PluginOption {
  let config: ResolvedConfig;
  const qiankunWindow = `__QIANKUN_WINDOW__["${opts.name}"]`;
  let publicPath = `(${qiankunWindow}.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ || "")`;
  const htmlPlugin = createHtmlPlugin({
    entry: opts.entry,
    preserveEntrySignatures: "strict",
  });
  return [
    {
      ...htmlPlugin,
      name: "qiankun:umd-build",
      apply: "build",
      config(config, env) {
        if (typeof htmlPlugin.config === "function")
          return htmlPlugin.config(
            {
              ...config,
              build: {
                ...config.build,
                minify: false,
                rollupOptions: {
                  output: {
                    ...config?.build?.rollupOptions?.output,
                    name: opts.name,
                    format: "umd",
                  },
                },
              },
            },
            env,
          );
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
      name: "qiankun:support-sandbox",
      enforce: "post",
      apply: "serve",
      async transform(code, id) {
        const [filepath] = id.split("?");
        const jsExts = [/\.[jt]sx?$/, /\.(c|m)?js?$/, /\.vue$/, /\.svelte$/];
        if (!jsExts.some((reg) => reg.test(filepath))) return;

        const baseTransformOptions = {
          root: process.cwd(),
          filename: id,
          sourceFileName: filepath,
          sourceMaps: true,
        };

        if (!opts.sandbox) {
          const qiankunGlobalVariables = [
            "window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__",
            "window.__POWERED_BY_QIANKUN__",
          ];
          if (
            !qiankunGlobalVariables.some((qiankunGlobalVariable) =>
              code.includes(qiankunGlobalVariable),
            )
          )
            return;

          const result = await transformAsync(code, {
            ...baseTransformOptions,
            plugins: [
              [
                plugin,
                {
                  replace: {
                    ...qiankunGlobalVariables.reduce(
                      (acc, qiankunGlobalVariable) => {
                        acc[qiankunGlobalVariable] =
                          qiankunGlobalVariable.replace(
                            "window",
                            qiankunWindow,
                          );
                        return acc;
                      },
                      {} as Record<string, string>,
                    ),
                  },
                },
              ],
            ],
          });

          if (result?.code) {
            return {
              code: result.code,
              map: result.map,
            };
          }

          return;
        }

        if (!/(document|window|globalThis|self)/g.test(code)) return;

        const result = await transformAsync(code, {
          ...baseTransformOptions,
          plugins: [
            [
              plugin,
              {
                replace: {
                  ...Object.keys(config.define ?? []).reduce(
                    (acc, key) => {
                      acc[key] = `${qiankunWindow}.${key}`;
                      return acc;
                    },
                    {} as Record<string, string>,
                  ),
                  window: qiankunWindow,
                },
                addWindowPrefix: true,
              },
            ],
          ],
        });

        if (result?.code) {
          return {
            code: result.code,
            map: result.map,
          };
        }
      },
    },
    {
      name: "qiankun:html-transform",
      enforce: "post",
      apply: "serve",
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
