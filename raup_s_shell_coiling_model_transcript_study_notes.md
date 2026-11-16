# Snail, Nautilus, Clam: One Rule, Three Numbers

---

## Verbatim Transcript

All the shells in the world are the same shell. The only things that change are three numbers. 

Look at this snail. If I change one number, it flattens out until it becomes a nautilus. If I change another, the nautilus opens up so much that it becomes a clam. And those same three numbers produce two things that aren't even shells: a ram's horn, and an elephant's tusk. All five shapes come from a single rule. 

That rule is simple: every shell is a tube that grows only at its mouth, and the old part no longer changes. 

The first number says how much that tube widens with each turn. In the nautilus, each full turn leaves the tube about three times wider. In the clam, that first number is huge. The tube widens so fast that it can't even complete one turn and ends up like a lid. Next time you eat clams, look at the tip of each shell, next to the hinge. It's slightly coiled. That's the beginning of the spiral. 

The second number is how far from the center the tube turns. Close to the center, each turn covers the previous one. Far away, the turns separate and leave a gap in the middle, like in a ram's horn. 

The third number is how much the tube drops with each turn. If it doesn't drop, the shell stays flat like the nautilus. If it does, it becomes a tower, like the snail. 

With those three numbers, you can make any shell. 

The three-number rule was published in 1966 by David Raup, an American paleontologist. Raup gave those numbers to a computer, and the computer, without copying any real shell, drew shells that looked real. 

But that's not the strangest part. Raup arranged all possible shells in a cube. Each axis is one of the three numbers, and each point in the cube is a shell. And in that cube, there are shells that no animal has, living or fossil. 

Those missing shells have two explanations. Raup wrote that they're possible on paper, but impossible or inefficient for an animal. Stephen J. Gould, a Harvard paleontologist, defended another idea: if the history of life started over, other shapes would emerge. According to that idea, those shells just never got their turn to appear. 

And the missing shells aren't just a few. When Raup marked the shells that do exist in the cube, almost the entire cube was left empty. Life only occupied a few corners of the cube. And yet, as different as they look...

*(Note: The final sentence cuts off right as the video loops back to the opening line: "...all the shells in the world are the same shell.")*

---

## Study Notes & Key Concepts

### 1. The Core Generative Rule
Biological shells (and similar structures like horns and tusks) grow via **accretion** at a single opening (the **mouth** or aperture). As new material is added to the mouth, the previously formed structure remains fixed and unchanged, resulting in a logarithmic spiral geometry.

### 2. David Raup’s Three Parameters (1966)
American paleontologist **David M. Raup** demonstrated that virtually all coiled biological shells can be mathematically generated using three parameters:

| Parameter | Label in Video | Definition | Effect on Form |
| :--- | :--- | :--- | :--- |
| **$W$** | **Widens / Turn** | Whorl expansion rate (how much the tube's diameter increases per full $360^\circ$ rotation). | **Low ($W \approx 3.0$):** Tightly coiled spiral (Nautilus).<br>**Extreme ($W \approx 1,000,000$):** Expands so rapidly it forms a flat valve/lid before completing one turn (Clam). |
| **$D$** | **Distance from Axis** | Distance of the generating curve (tube) from the central coiling axis. | **Low ($D \approx 0.00$):** Subsequent whorls overlap and cover previous ones (Snail, Nautilus).<br>**High ($D > 0.35$):** Whorls separate, leaving an open central gap/umbilicus (Ram's horn, Elephant tusk). |
| **$T$** | **Drop / Turn** | Translation rate (how far the tube moves along the vertical axis per turn). | **Zero ($T = 0.0$):** Planispiral / flat shell (Nautilus, Clam).<br>**High ($T > 0.5$):** Helicospiral / three-dimensional tower (Sea snail). |

### 3. Example Parameter Combinations Shown in Video
* **Sea Snail:** $W = 3.0$, $D = 0.00$, $T = 2.1$
* **Nautilus:** $W = 3.0$, $D = 0.00$, $T = 0.0$
* **Clam:** $W = 1,000,000$, $D = 0.03$, $T = 0.0$
* **Ram's Horn:** $W = 7.0$, $D = 0.38$, $T = 0.6$
* **Elephant Tusk:** $W = 1,585$, $D = 0.86$, $T = 0.0$

### 4. Theoretical Morphospace & Missing Forms
Raup plotted all possible combinations of $(W, D, T)$ into a three-dimensional coordinate space ("morphospace" cube), where every point represents a theoretically possible shell shape. Surprisingly, **almost the entire cube is empty** in nature—real living and fossil organisms cluster in only a few tight regions.

Two primary evolutionary explanations account for the unoccupied regions of the cube:
1. **Functional & Biomechanical Constraints (David Raup):** Unoccupied forms are mathematically valid on paper, but biologically unviable—for example, shells with disconnected, sprawling coils that are structurally weak, energetically expensive to build, or impossible for an animal to carry/balance.
2. **Historical Contingency (Stephen J. Gould):** Evolution is shaped by historical chance rather than deterministic optimization. If life's evolutionary tape were "replayed," different lineages might have explored and populated entirely different regions of the morphospace cube.