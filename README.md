# Flesch Gauge

Universal reactive component for displaying copy readability using the Flesch Reading Ease formula.

## Vanilla ES6+

```
import FleschGauge from 'flesch-gauge'

const fleschGauge = new FleschGauge({
    target: document.querySelector('#flesch-gauge-container'),
    props: {
        content: "This is the content to be measured."
    },
})
```

## Vue

```
<template>
    <div>
        <FleschGauge :content="content">
    </div>
</template>

<script>
import FleschGauge from 'flesch-gauge/vue'

export default {
  name: 'app',
  components: {
    FleschGauge,
  },
  data() {
      return {
          content: "This is the content to be measured."
      }
  },
}
</script>
```

## React

```
import React from 'react';
import FleschGauge from 'flesch-gauge/react'

const content = "This is the content to be measured."

const App = () => <FleschGauge content={content}/>

export default App;
```
