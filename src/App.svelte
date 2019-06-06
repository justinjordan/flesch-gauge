<script>
    import Ring from './Ring.svelte'
	import Calculate from './calculate.js'

    $: score = Calculate(content)

    export let content = ''
</script>

<Ring percent={score}/>
<p>Score: {score}</p>