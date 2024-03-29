import pluginTester from "babel-plugin-tester";
import plugin from ".";

pluginTester({
  plugin: plugin,
  pluginOptions: {
    replace: {
      document: '__TEST__["test"].document',
      window: "__TEST__.window",
      "process.env.TEST": "__TEST__.process.env.TEST",
    },
    addWindowPrefix: true,
  } as Exclude<Parameters<typeof plugin>[1], null>,
  tests: {
    "console snapshot": {
      code: `
        console.log("window", window);
        console.log("document", document);
        console.log("self", self);
        console.log("process.env.TEST", process.env.TEST);
      `,
      snapshot: true,
    },
    "variable snapshot": {
      code: `
        const window = "test";
        const document = "test";
        const self = "test";
        const process = {
          env: {
            TEST: "test",
          },
        }
        window;
        document;
        self;
        process.env.TEST
      `,
      snapshot: true,
    },
    "IIFE snapshot": {
      code: `
        (function(window, document, self, process) {
          window;
          document;
          self;
          process.env.TEST;
        })(window, document, self);
      `,
      snapshot: true,
    },
    "function snapshot": {
      code: `
        function test(window, document, self, process) {
          window;
          document;
          self;
          process.env.TEST;
        }
        window;
        document;
        self;
        process.env.TEST;
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
          get window() {
            return window;
          },
          set window(window) {},
          document: document,
          get document() {
            return document;
          },
          set document(document) {},
          self: self,
          get self() {
            return self;
          },
          set self(self) {},
          "process.env.TEST": process.env.TEST,
        };
        const test2 = {
          window,
          document,
          self,
        };
      `,
      snapshot: true,
    },
    "class snapshot": {
      code: `
        class Test {
          #window
          self
          constructor(window, self, process) {
            this.window = window;
            this.self = self;
            this.test = process.env.TEST;
          }
          document() {
            return document;
          }
          self = () => {
            return this.self;
          }
          get window() {
            return this.#window;
          }
          set window(window) {
            this.#window = window;
          }
        }
      `,
      snapshot: true,
    },
    "import statement snapshot": {
      code: `
        import window, { document, self, process } from "test";
        window;
        document;
        self;
        process.env.TEST
      `,
      snapshot: true,
    },
    "export statement snapshot": {
      code: `
        export { window, document, self } from "test";
      `,
      snapshot: true,
    },
    "optional chaining snapshot": {
      code: `
        test?.window;
      `,
      snapshot: true,
    },
  },
});
