import React from "./my-react";

const element = (
	<div id="foo">
		<a href="/">bar</a>
		<b />
	</div>
);

const container = document.getElementById("root");
React.render(element, container);
