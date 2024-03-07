import pluginTester from "babel-plugin-tester";
import plugin from ".";

pluginTester({
  plugin: plugin,
  pluginOptions: {
    replace: {
      document: '__TEST__["test"].document',
      window: "__TEST__.window",
      self: "__TEST__.self",
    },
  } as Exclude<Parameters<typeof plugin>[1], null>,
  tests: {
    "console snapshot": {
      code: `
        console.log("window", window);
        console.log("document", document);
        console.log("self", self);
      `,
      snapshot: true,
    },
    "IIFE snapshot": {
      code: `
        (function(window, document, self) {
          window;
          document;
          self;
        })(window, document, self);
      `,
      snapshot: true,
    },
    "function snapshot": {
      code: `
        function test(window, document, self) {
          window;
          document;
          self;
        }
        window;
        document;
        self;
      `,
      snapshot: true,
    },
    "function invocation snapshot": {
      code: `
        function window() {}
        function document() {}
        function self() {}
        window();
        document();
        self();
      `,
      snapshot: true,
    },
    "allow function invocation snapshot": {
      code: `
        const window = () => {};
        const document = () => {};
        const self = () => {};
        window();
        document();
        self();
      `,
      snapshot: true,
    },
    "event listener snapshot": {
      code: `
        window.addEventListener("xxx", () => {});
        document.addEventListener("xxx", () => {});
        self.addEventListener("xxx", () => {});
      `,
      snapshot: true,
    },
    "object literal snapshot": {
      code: `
        const test1 = {
          window: window,
          document: document,
          self: self,
        };
        const test2 = {
          window,
          document,
          self,
        };
      `,
      snapshot: true,
    },
  },
});
