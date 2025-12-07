function createTextElement(text) {
	return {
		type: "TEXT_ELEMENT",
		props: {
			nodeValue: text,
			children: [],
		},
	};
}

function createElement(type, props, ...children) {
	return {
		type,
		props: {
			...props,
			children: children.map((child) =>
				typeof child === "object" ? child : createTextElement(child),
			),
		},
	};
}

function createDom(fiber) {
	const dom =
		fiber.type === "TEXT_ELEMENT"
			? document.createTextNode("")
			: document.createElement(fiber.type);

	updateDom(dom, {}, fiber.props);

	return dom;
}

let nextUnitOfWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = null;

function render(element, container) {
	wipRoot = {
		dom: container,
		props: {
			children: [element],
		},
		alternate: currentRoot,
	};

	deletions = [];
	nextUnitOfWork = wipRoot;
}

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);

function updateDom(dom, prevProps, nextProps) {
	// Remove old properties
	Object.keys(prevProps)
		.filter(isProperty)
		.filter(isGone(prevProps, nextProps))
		.forEach((name) => {
			dom[name] = "";
		});

	// Set new or changed properties
	Object.keys(nextProps)
		.filter(isProperty)
		.filter(isNew(prevProps, nextProps))
		.forEach((name) => {
			dom[name] = nextProps[name];
		});

	// Remove old or changed event listeners
	Object.keys(prevProps)
		.filter(isEvent)
		.filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
		.forEach((name) => {
			const eventType = name.toLowerCase().substring(2);
			dom.removeEventListener(eventType, prevProps[name]);
		});

	// Add event listeners
	Object.keys(nextProps)
		.filter(isEvent)
		.filter(isNew(prevProps, nextProps))
		.forEach((name) => {
			const eventType = name.toLowerCase().substring(2);
			dom.addEventListener(eventType, nextProps[name]);
		});
}

function commitDeletion(fiber, domParent) {
	if (fiber.dom) {
		domParent.removeChild(fiber.dom);
	} else {
		commitDeletion(fiber.child, domParent);
	}
}

function commitWork(fiber) {
	if (!fiber) {
		return;
	}

	let domParentFiber = fiber.parent;
	while (!domParentFiber.dom) {
		domParentFiber = domParentFiber.parent;
	}

	const domParent = domParentFiber.dom;

	if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
		domParent.appendChild(fiber.dom);
	} else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
		updateDom(fiber.dom, fiber.alternate.props, fiber.props);
	} else if (fiber.effectTag === "DELETION") {
		commitDeletion(fiber, domParent);
	}

	commitWork(fiber.child);
	commitWork(fiber.sibling);
}

function commitRoot() {
	deletions.forEach(commitWork);

	commitWork(wipRoot.child);

	// Run effects after commit
	runEffects(wipRoot.child);

	currentRoot = wipRoot;
	wipRoot = null;
}

function runEffects(fiber) {
	if (!fiber) {
		return;
	}

	// Run cleanup functions from previous render
	if (fiber.hooks) {
		fiber.hooks.forEach((hook) => {
			if (hook.cleanup) {
				hook.cleanup();
			}
		});
	}

	// Run new effects and store cleanup functions
	if (fiber.hooks) {
		fiber.hooks.forEach((hook) => {
			if (hook.effect) {
				const cleanup = hook.effect();
				if (typeof cleanup === "function") {
					hook.cleanup = cleanup;
				}
			}
		});
	}

	runEffects(fiber.child);
	runEffects(fiber.sibling);
}

function reconcileChildren(wipFiber, elements) {
	let index = 0;
	let oldFiber = wipFiber.alternate?.child;
	let prevSibling = null;

	while (index < elements.length || oldFiber != null) {
		const element = elements[index];
		let newFiber = null;

		const sameType = oldFiber && element && element.type === oldFiber.type;

		if (sameType) {
			newFiber = {
				type: oldFiber.type,
				props: element.props,
				dom: oldFiber.dom,
				parent: wipFiber,
				alternate: oldFiber,
				effectTag: "UPDATE",
			};
		}

		if (element && !sameType) {
			newFiber = {
				type: element.type,
				props: element.props,
				dom: null,
				parent: wipFiber,
				alternate: null,
				effectTag: "PLACEMENT",
			};
		}

		if (oldFiber && !sameType) {
			oldFiber.effectTag = "DELETION";
			deletions.push(oldFiber);
		}

		if (oldFiber) {
			oldFiber = oldFiber.sibling;
		}

		if (index === 0) {
			wipFiber.child = newFiber;
		} else {
			prevSibling.sibling = newFiber;
		}

		prevSibling = newFiber;
		index++;
	}
}

let wipFiber = null;
let hookIndex = null;

function updateFunctionComponent(fiber) {
	wipFiber = fiber;
	hookIndex = 0;
	wipFiber.hooks = [];

	const children = [fiber.type(fiber.props)];
	reconcileChildren(fiber, children);
}

function useState(initial) {
	const oldHook = wipFiber.alternate?.hooks?.[hookIndex];
	const hook = { state: oldHook ? oldHook.state : initial, queue: [] };

	const actions = oldHook ? oldHook.queue : [];

	actions.forEach((action) => {
		hook.state = action(hook.state);
	});

	const setState = (action) => {
		hook.queue.push(action);

		wipRoot = {
			dom: currentRoot.dom,
			props: currentRoot.props,
			alternate: currentRoot,
		};

		nextUnitOfWork = wipRoot;
		deletions = [];
	};

	wipFiber.hooks.push(hook);
	hookIndex++;

	return [hook.state, setState];
}

function useEffect(callback, deps) {
	const oldHook = wipFiber.alternate?.hooks?.[hookIndex];

	const hasChanged =
		!oldHook ||
		!deps ||
		!oldHook.deps ||
		deps.some((dep, i) => dep !== oldHook.deps[i]);

	const hook = {
		deps,
		cleanup: oldHook?.cleanup,
	};

	if (hasChanged) {
		// Schedule the effect to run after commit
		hook.effect = callback;
	}

	wipFiber.hooks.push(hook);
	hookIndex++;
}

function updateHostComponent(fiber) {
	if (!fiber.dom) {
		fiber.dom = createDom(fiber);
	}

	reconcileChildren(fiber, fiber.props.children);
}

function performUnitOfWork(fiber) {
	const isFunctionComponent = fiber.type instanceof Function;
	if (isFunctionComponent) {
		updateFunctionComponent(fiber);
	} else {
		updateHostComponent(fiber);
	}

	if (fiber.child) {
		return fiber.child;
	}

	let nextFiber = fiber;
	while (nextFiber) {
		if (nextFiber.sibling) {
			return nextFiber.sibling;
		}

		nextFiber = nextFiber.parent;
	}
}

function workLoop(deadline) {
	let shouldYield = false;
	while (nextUnitOfWork && !shouldYield) {
		nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
		shouldYield = deadline.timeRemaining() < 1;
	}

	if (!nextUnitOfWork && wipRoot) {
		commitRoot();
	}

	requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

const React = { createElement, render, useState, useEffect };

export default React;
