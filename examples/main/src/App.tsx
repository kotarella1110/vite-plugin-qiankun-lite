import { BrowserRouter } from "react-router-dom";
import { Link } from "react-router-dom";
import { RootProps } from "./types";

function App({ loading }: RootProps) {
  return (
    <BrowserRouter>
      <div style={{ display: "flex", justifyContent: "start" }}>
        <nav
          style={{
            padding: "32px",
            minHeight: "100vh",
          }}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li style={{ padding: "8px" }}>
              <Link to="react">React</Link>
            </li>
            <li style={{ padding: "8px" }}>
              <Link to="vue">Vue</Link>
            </li>
            <li style={{ padding: "8px" }}>
              <Link to="svelte">Svelte</Link>
            </li>
          </ul>
        </nav>
        {loading && <p>Loading...</p>}
        <main id="sub-app" />
      </div>
    </BrowserRouter>
  );
}

export default App;
