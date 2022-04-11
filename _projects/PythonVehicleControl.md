---
title: "PythonVehicleControl"
excerpt: "Quick and dirty python environment for vehicle simulation"
header:
  teaser: assets/images/projects/pyVehCtrl_mini.png
---

![PythonVehicleControl](/assets/images/projects/pyVehCtrl.png)

Designing control systems is **always** an iterative process, where
you as an engineer is constantly trying to improve the ways in which 
you can have a sandboxed environment for prototyping. While working 
on lateral control software for self-driving cars, I had a pain-point 
about not being able to easily prototype and visualize the performance 
of the control algorithms and compare them through multiple runs of 
simulations. 
[PythonVehicleControl](https://github.com/yongkyuns/PythonVehicleControl)
is a project I used to evaluate the python ecosystem for constructing 
a quick-and-dirty simulation environment. Several algorithms (
[PID](https://en.wikipedia.org/wiki/PID_controller), 
[MPC](https://en.wikipedia.org/wiki/Model_predictive_control) and 
[DDPG RL](https://towardsdatascience.com/deep-deterministic-policy-gradients-explained-2d94655a9b7b)) 
are implemented and GUI/visualization is done using
[PyQT](https://wiki.python.org/moin/PyQt) and 
[PyQTGraph](https://www.pyqtgraph.org/). 







