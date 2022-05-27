![](/assets/images/blog/change.png)

Recently, I have gone through the process of migrating my team's
default unit test framework from model-based tools to hand-code. I had strong 
reasons that made me believe it was the right move for the team, but 
those reasons were initially not obvious to a team that primarily 
focuses on model-based development. Without dwelling too much on the 
technical details (which I will likely cover in another blog), I would 
like to reflect on the process of introducing a non-obvious and sensitive 
change to a team in a minimally-disruptive manner.

Change is inevitable for technology companies to grow and evolve. It's what 
allows them to remain competitive in today's fast-changing world. For the 
most part, companies that manage to survive do a good job of constantly 
improving or re-inventing their products. However, I believe that the extent 
of change that drives product innovation does not always happen to the basic 
tools and infrastructure which are used to build those products. For example, 
if you are building a software, you may use an older version of compiler for 
reasons such as stability or better compatibility

drives product innovation does not always have equal amount of innovation

true when it comes to the tooling and infrastructure 



However, change is also disruptive and uncomfortable by nature. 
When the stakes are high, the most natural thing to do for us as humans 
is to stick to the methods that have worked in the past. As the old saying
goes, "If it ain't broken, don't fix it!" In some cases,
proposing a change can initially bring visibly negative impacts to 
the very problem that you are trying to solve by those changes. This
is one of the reasons why safety-critical or mission-critical software
does not undergo drastic changes as you would normally see in other 
software domains  [[1][1]]. By natural extension, the same thing can be said 
about the tooling and infrastructure for building these software.

However, pre-existing or established engineering solutions rarely represent
an optimal way to solve a particular problem. This applies even for a
seemingly trivial problem such as how a unit test is conducted and what
kind of test framework is used. When we encounter this kind of challenge,
how do we address them without causing a significant disruption and without
losing motivation to pursue those changes to ultimately bring improvements 
to your team? In the next few paragraphs, I would like to touch on the 
problem I faced and the strategy I used to navigate through these situations.

Before we discuss anything, it's important to provide some historical context. 
Over the past couple of years, my team has undergone a couple rounds of
test framework overhaul under the larger organizational direction. The goal
was to standardize the test assets for better maintainability and efficiency.
However, we were noticing a few core problems that persisted from the old ways of
conducting our tests. They all had to do with the lack of generalizable and
robust methods to easily isolate the relevant software module and the lack of control 
developers had around authoring specific tests. Scaling with an incomplete
solution did give us a sense of achievement and brought improvements in a 
few areas, but the root-cause of the problem largely remained unsolved. As
a result, we were constantly incurring significant amount of time to maintain
and expand our tests.

Around this time, we had come across another alternative framework that we 
could possibly explore. It was pretty clear that this framework would solve
at least some of the hairy problems we had with our current approach, but 
there was a catch. It would require us to move away from our existing
model-based test and migrate our test assets to C++. Since the team was generally
not familiar with writing C++ in produciton, it would at least pose some
risk in terms of ramping up our uses while continuously delivering our features
across the product line. So the general sentiment was to not consider it,
in favor of the stability that our current method provides.

The first thing that you as an initiator of change need to do in this situation
is to analyze to the best of your ability the potential benefits of the change
you are proposing. This is not clear to any of your team yet, and your opinions
may be biased toward your proposal. So until your hypothesis is validated, repeatly
bringing up the topic may cause more confusion and anxiety than excitement. It's 
sufficient to float the idea and keep track of its visibility within the team.

After the initial seeding of ideas take place, you have several product increment 
cycles to do two things: 1. Find someone in your team that's willing to evaluate
your proposal, and 2. Iterate through the proposed solution to identify unexpected
loop-holes and missing features. Sandboxing your experiment to a minimum scale 
is important in order to eliminate any potential risks. Your first colleague for
evaluating your idea is critical, because you will gain the most valuable insights
from a third-person's perspective. After this stage, you will most likely know 
whether your proposed change has potential to be a net improvement to your team.









[1]: https://www.fastcompany.com/28121/they-write-right-stuff




