import { useState } from "react";
import {
  defineReactInstrument,
  useInstrumentApi,
  UIRoot,
  UISection,
  UICard,
  UIButton,
} from "tango-api";

function SidebarPanel() {
  return (
    <UIRoot style={{ padding: 12 }}>
      <UISection title="{{DISPLAY_NAME}}">
        <UICard>
          <p style={{ opacity: 0.6, fontSize: 13 }}>
            Your instrument sidebar. Add navigation, lists, or controls here.
          </p>
        </UICard>
      </UISection>
    </UIRoot>
  );
}

function MainPanel() {
  const api = useInstrumentApi();
  const [message, setMessage] = useState("Hello from {{DISPLAY_NAME}}!");

  // {{#IF_BACKEND}}
  // Call a backend action
  async function handleGreet() {
    try {
      const result = await api.actions.call<{ name: string }, { greeting: string }>(
        "hello",
        { name: "Tango" },
      );
      setMessage(result.greeting);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  }
  // {{/IF_BACKEND}}

  return (
    <UIRoot style={{ padding: 12 }}>
      <UISection title="{{DISPLAY_NAME}}">
        <UICard>
          <p style={{ fontSize: 14, marginBottom: 12 }}>{message}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <UIButton label="Click me" variant="primary" onClick={() => setMessage("Button clicked!")} />
            {/* {{#IF_BACKEND}} */}
            <UIButton label="Call Backend" variant="secondary" onClick={handleGreet} />
            {/* {{/IF_BACKEND}} */}
          </div>
        </UICard>
      </UISection>
    </UIRoot>
  );
}

export default defineReactInstrument({
  defaults: {
    visible: {
      sidebar: true,
      first: true,
    },
  },
  panels: {
    sidebar: SidebarPanel,
    first: MainPanel,
  },
});
