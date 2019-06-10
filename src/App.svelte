<script>
    import Ring from './Ring.svelte'
    import Calculate from './calculate.js'

    // define props
    export let color = ''
    export let content = ''

    let rating = ''
    $: score = Calculate(content)
    $: {
        if (isNaN(score)) {
            score = 0
            rating = 'Waiting...'
        } else if (score < 30) {
            rating = 'Very Difficult'
        } else if (score >= 30 && score < 50) {
            rating = 'Difficult'
        } else if (score >= 50 && score < 60) {
            rating = 'Fairly Difficult'
        } else if (score >= 60 && score < 70) {
            rating = 'Plain English'
        } else if (score >= 70 && score < 80) {
            rating = 'Fairly Easy'
        } else if (score >= 80 && score < 90) {
            rating = 'Easy'
        } else if (score >= 90) {
            rating = 'Very Easy'
        }
    }
</script>

<style>
.flesch-gauge__inner-wrap {
    display: inline-block;
    position: relative;
}
.flesch-gauge__copy {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: sans-serif;
    font-weight: bold;
}
.flesch-gauge__copy p {
    margin: 0;
    margin-bottom: 5px;
    text-align: center;
}

.flesch-gauge__score {
    font-size: 1.4em;
}
.flesch-gauge__rating {
    white-space: nowrap;;
    font-size: 0.7em;
}
</style>

<div class="flesch-gauge__inner-wrap">
    <Ring
        color={color}
        percent={score}
    />
    <div class="flesch-gauge__copy">
        <p class="flesch-gauge__score">{score}</p>
        <p class="flesch-gauge__rating">{rating}</p>
    </div>
</div>