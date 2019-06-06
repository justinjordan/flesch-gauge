<template>
    <div class="flesch-gauge" ref="entry"></div>
</template>

<script>
import FleschGauge from './dist/bundle.js'

export default {
    props: [
        'content'
    ],
    mounted() {
        this.fleschGauge = new FleschGauge({
            target: this.$refs.entry,
            props: {
                content: this.content,
            },
        })
    },
    updated() {
        this.$nextTick(() => {
            this.fleschGauge.$set({
                content: this.content,
            })
        })
    },
}
</script>
