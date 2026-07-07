import { useRef, useState } from "react";
import type { BrushTimeline } from "brushmark";
import {
  BrushAnnotation,
  BrushAnnotationGroup,
  useBrushAnnotation,
} from "brushmark/react";

export function App() {
  return (
    <main>
      <header className="hero">
        <p className="eyebrow">brushmark · react wrapper · StrictMode on</p>
        <h1>
          <BrushAnnotation type="contour" brush={{ name: "2B", color: "#c93030", weight: 1.4 }} duration={1.4} delay={0.3}>
            Declarative brushes
          </BrushAnnotation>{" "}
          for React
        </h1>
        <p className="lede">
          The same painterly engine, driven by components and hooks —{" "}
          <BrushAnnotation type="highlight" brush={{ name: "marker", color: "#f2c94c" }} duration={1} delay={1.5}>
            fully compatible with GSAP timelines
          </BrushAnnotation>
          .
        </p>
        <p>
          <a className="react-link" href="../vanilla/index.html">← Vanilla demo</a>
        </p>
      </header>

      <ToggleSection />
      <HookSection />
      <GroupSection />
      <TimelineSection />
    </main>
  );
}

function ToggleSection() {
  const [visible, setVisible] = useState(true);
  return (
    <section>
      <h2>Declarative visibility</h2>
      <p className="note">
        The <code>show</code> prop plays the timeline forward, un-draws it in reverse.
      </p>
      <p style={{ fontSize: 20 }}>
        Some decisions are{" "}
        <BrushAnnotation
          type="box"
          show={visible}
          brush={{ name: "pen", color: "#1971c2", weight: 1.4 }}
          duration={0.8}
        >
          reversible after all
        </BrushAnnotation>
        .
      </p>
      <button onClick={() => setVisible((v) => !v)}>{visible ? "Un-draw" : "Draw"}</button>
    </section>
  );
}

function HookSection() {
  const { ref, show, hide } = useBrushAnnotation<HTMLSpanElement>({
    type: "circle",
    brush: { name: "charcoal", color: "#5f3dc4", weight: 1.3 },
    duration: 1,
    iterations: 2,
  });
  return (
    <section>
      <h2>useBrushAnnotation</h2>
      <p className="note">Imperative control from a hook, ref attached to any element.</p>
      <p style={{ fontSize: 20 }}>
        The hook version gives you{" "}
        <span ref={ref as React.Ref<HTMLSpanElement>}>full manual control</span> when you need it.
      </p>
      <div className="controls-row">
        <button onClick={show}>show()</button>
        <button onClick={() => hide()}>hide()</button>
      </div>
    </section>
  );
}

function GroupSection() {
  const [key, setKey] = useState(0);
  return (
    <section>
      <h2>BrushAnnotationGroup</h2>
      <p className="note">Children sequence themselves in render order on one master timeline.</p>
      <div key={key}>
        <BrushAnnotationGroup overlap={0.1}>
          <p style={{ fontSize: 20 }}>
            First{" "}
            <BrushAnnotation type="underline" brush={{ name: "2B", color: "#c93030" }} duration={0.7}>
              gather the pigments
            </BrushAnnotation>
            , then{" "}
            <BrushAnnotation type="highlight" brush={{ name: "marker", color: "#96f2d7" }} duration={0.8}>
              lay down broad strokes
            </BrushAnnotation>
            , and only then{" "}
            <BrushAnnotation type="crossed-off" brush={{ name: "HB", color: "#495057", weight: 1.4 }} duration={0.7}>
              erase your doubts
            </BrushAnnotation>
            .
          </p>
        </BrushAnnotationGroup>
      </div>
      <button onClick={() => setKey((k) => k + 1)}>Replay (remount)</button>
    </section>
  );
}

function TimelineSection() {
  const tlRef = useRef<BrushTimeline | null>(null);
  return (
    <section>
      <h2>onTimeline — adopt into your own GSAP world</h2>
      <p className="note">
        The annotation's paused timeline is handed to you; scrub it, nest it, ScrollTrigger it.
      </p>
      <p style={{ fontSize: 20 }}>
        This stroke is{" "}
        <BrushAnnotation
          type="underline"
          show={false}
          brush={{ name: "crayon", color: "#e8590c", weight: 1.5 }}
          duration={1}
          onTimeline={(tl) => (tlRef.current = tl)}
        >
          driven entirely by the slider
        </BrushAnnotation>
        .
      </p>
      <div className="controls-row">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          defaultValue={0}
          onInput={(e) => tlRef.current?.progress(Number(e.currentTarget.value)).pause()}
        />
      </div>
    </section>
  );
}
