<script>
  import { onMount, tick } from "svelte";
  let image = null;
  let fileinput, canvas;
  let width = 500;
  let height = 500;

  let hCells = 5;
  let vCells = 5;

  const strokeWidth = 3;

  const drawGrid = (shiftX, shiftY, endX, endY) => {
    const ctx = canvas.getContext("2d");
    if (hCells > 1) {
      for (let h = 0; h < hCells + 1; h++) {
        let imgOffset = ((endX - strokeWidth) / hCells) * h;
        ctx.strokeStyle = "red";
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.moveTo(shiftX + imgOffset + strokeWidth / 2, shiftY);
        ctx.lineTo(shiftX + imgOffset + strokeWidth / 2, endY + shiftY);
        ctx.stroke();
      }
    }
    if (vCells > 1) {
      for (let v = 0; v < vCells + 1; v++) {
        let imgOffset = ((endY - strokeWidth) / vCells) * v;
        ctx.strokeStyle = "red";
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.moveTo(shiftX, shiftY + imgOffset + strokeWidth / 2);
        ctx.lineTo(shiftX + endX, shiftY + imgOffset + strokeWidth / 2);
        ctx.stroke();
      }
    }
  };

  onMount(async () => {
    canvas.width = width;
    canvas.height = height;
    await tick();
    redraw();
  });

  const redraw = () => {
    if (image === null) {
      return;
    }
    const ctx = canvas.getContext("2d");
    var hRatio = canvas.width / image.width;
    var vRatio = canvas.height / image.height;
    var ratio = Math.min(hRatio, vRatio);
    var centerShift_x = (canvas.width - image.width * ratio) / 2;
    var centerShift_y = (canvas.height - image.height * ratio) / 2;
    let endX = image.width * ratio;
    let endY = image.height * ratio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      centerShift_x,
      centerShift_y,
      endX,
      endY
    );
    drawGrid(centerShift_x, centerShift_y, endX, endY);
  };

  const onFileSelected = (e) => {
    image = new Image();
    image.onload = redraw.bind(null);
    image.src = URL.createObjectURL(e.target.files[0]);
  };

  const dispatchResize = () => {
    canvas.width = width;
    canvas.height = height;
    redraw();
  };

  let phCells = hCells;
  let pvCells = vCells;

  function hValidator(node, value) {
    return {
      update(value) {
        hCells =
          value === null || hCells < node.min ? phCells : parseInt(value);
        phCells = hCells;
        redraw();
      },
    };
  }

  function vValidator(node, value) {
    return {
      update(value) {
        vCells =
          value === null || vCells < node.min ? pvCells : parseInt(value);
        pvCells = vCells;
        redraw();
      },
    };
  }

  const save = (event) => {
    var image = canvas.toDataURL("image/png");
    event.target.href = image;
  };
</script>

<svelte:window on:resize={dispatchResize} />

<div id="app" bind:clientWidth={width} bind:clientHeight={height}>
  <h1>Image Grid</h1>
  <div class="input-container">
    <div
      class="button upload"
      on:click={() => {
        fileinput.click();
      }}
    >
      Choose Image
    </div>
    <a
      class="button download"
      download="grid-image.png"
      on:click={save}
      href="local"
    >
      Download Image
    </a>
  </div>
  <canvas
    bind:clientWidth={width}
    bind:clientHeight={height}
    id="cv"
    bind:this={canvas}
  />

  <input
    style="display:none"
    type="file"
    accept=".jpg, .jpeg, .png"
    on:change={(e) => onFileSelected(e)}
    bind:this={fileinput}
  />
  <div class="input-container">
    <div>
      <label for="horizontal">Horizontal Cells</label>
      <input
        name="horizontal"
        type="number"
        use:hValidator={hCells}
        bind:value={hCells}
        min="1"
      />
    </div>
    <div>
      <label for="vertical">Vertical Cells</label>
      <input
        name="vertical"
        type="number"
        use:vValidator={vCells}
        bind:value={vCells}
        min="1"
      />
    </div>
  </div>
</div>

<style>
  #app {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-flow: column;
  }

  .button {
    color: #333;
    display: flex;
    height: 40px;
    width: 150px;
    cursor: pointer;
    border-radius: 5px;
    align-items: center;
    justify-content: center;
  }
  .upload {
    background-color: lightskyblue;
  }
  .download {
    background-color: lightgreen;
  }

  .input-container {
    display: flex;
    gap: 24px;
  }

  #cv {
    height: 68vh;
    width: 68vw;
    margin-top: 32px;
    margin-bottom: 28px;
    display: block;
  }
</style>
