<script>
  export let color = 'black'
  export let radius = 52
  export let percent = 100

  let circumference = radius * 2 * Math.PI

  let strokeDasharray = `${circumference} ${circumference}`
  let strokeDashoffset = circumference

  $: {
    // timeout to enable transition
    setTimeout(() => {
      strokeDashoffset = circumference - percent / 100 * circumference
    }, 0)
  }
</script>

<style>
.progress-ring__circle {
  transition: stroke-dashoffset 800ms ease-in-out;
  transform: rotate(90deg);
  transform-origin: center;
}
</style>

<svg
   class="progress-ring"
   width="120"
   height="120">
  <circle
    class="progress-ring__circle"
    stroke={color}
    stroke-width="10"
    stroke-linecap="round"
    stroke-dasharray={strokeDasharray}
    stroke-dashoffset={strokeDashoffset}
    fill="transparent"
    r={radius}
    cx="60"
    cy="60"/>
</svg>