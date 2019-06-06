<script>
	import Calculate from './calculate.js'

    $: score = Calculate(content)

    export let content = ''
</script>

<p>Score: {score}</p>