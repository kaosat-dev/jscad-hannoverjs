/// //////////////////////////////////////////
//
// NameTag Factory with OpenJSCAD.org
// Idea and modeling by Kurt Meister | google.com/+KurtMeister
// Juli 2014
// modified by Mark Moissette Feb 2018
// CC BY-NC-SA 3.0
// ---
// Browse to http://openjscad.org/ and drop this file into the dashed area.
//
/// //////////////////////////////////////////

function getParameterDefinitions () {
  return [
    {name: 'nameText', caption: 'Text:', type: 'text', default: 'JSCAD'},
    {name: 'textColor', caption: 'Text color:', type: 'color', default: rgbToHex([0, 0, 0])},
    {name: 'bodyColor', caption: 'Body color:', type: 'color', default: rgbToHex([0.89, 1, 0])},
    {name: 'textThickness', caption: 'Text thickness:', type: 'float', default: 2},
    {name: 'fontweight', caption: 'Fontweight:', type: 'float', default: 5},
    {name: 'fontwidth', caption: 'Fontwidth [%]:', type: 'float', default: 100},
    {name: 'thickness', caption: 'Thickness:', type: 'float', default: 2},
    {name: 'width', caption: 'Width:', type: 'float', default: 9},
    {name: 'cornerRadius', caption: 'Corner radius:', type: 'float', default: 4},
    {name: 'resolution', caption: 'Resolution', type: 'int', default: 24}
  ]
}

function main (params) {
  const {nameText, thickness, width, cornerRadius, resolution} = params
  // const bodyColor = [0.89, 1, 0]// [0.3, 0.3, 0.3] //[1, 0.3, 0]
  // const textColor = [0.3, 0.3, 0.3]// [0.89, 1, 0]//[0.2, 0.2, 0.2]
  let length = 0
  const textColor = hexToRgb(params.textColor)
  const bodyColor = hexToRgb(params.bodyColor)

  // Text
  const mainText = measuredText(Object.assign({}, params, {textColor}), nameText)
  const tagText = mainText.text
  length = mainText.length

  const bottomText = measuredText(Object.assign({}, params, {textColor, fontwidth: 65, fontweight: 2}), 'hannover.js')

  // body
  const tagCorner = circle({r: cornerRadius, fn: resolution, center: true})

  const tagCorner1 = translate([length - cornerRadius, width - cornerRadius], tagCorner)
  const tagCorner2 = translate([length - cornerRadius, -width + cornerRadius], tagCorner)
  const tagCorner3 = translate([-length + cornerRadius, width - cornerRadius], tagCorner)
  const tagCorner4 = translate([-length + cornerRadius, -width + cornerRadius], tagCorner)
  const bodyShape = hull([tagCorner1, tagCorner2, tagCorner3, tagCorner4])
  const bodyMain = linear_extrude({height: thickness}, bodyShape)

  // Cutout
  const holeShape = hull(
    translate([0, -2.5], circle({r: 2.5, center: true})),
    translate([0, 2.5], circle({r: 2.5, center: true}))
  )
  const attachHole = translate([-length + 5, 0, 0], linear_extrude({height: thickness}, holeShape))

  // gear
  const decoGear = translate([length / 1.5, 0, thickness / 2],
    gear({centerholeradius: 0, circularPitch: 10, thickness, numTeeth: 10}))
  const body = union([bodyMain, decoGear])

  return union([
    color(bodyColor, difference([
      body,
      attachHole,
      translate([8, 0, -0.1], mirror([1, 0, 0], bottomText.text))
    ])
    ),
    translate([0, 0, thickness - 0.1], tagText)
  ])
}

function measuredText (params, string) {
  const {textThickness, textColor, fontweight, fontwidth, thickness} = params
  const adjustedFontWidth = fontwidth / 100 * 0.33
  let length = 0
  const textPolyLines = vector_text(0, 0, string)   // l contains a list of polylines to be drawn
  const text3d = textPolyLines.map((pl) => {          // pl = polyline (not closed)
    return rectangular_extrude(pl, {w: fontweight, h: textThickness}) // extrude it to 3D
  })

  let text = scale([adjustedFontWidth, 0.33, 0.5], union(text3d))
  length = (text.getBounds()[1].x - text.getBounds()[0].x + 17) / 2 // get the size of the text
  text = translate([-length + 11, -3, 0], text)
  text = color(textColor, text)

  return {text, length}
}

function hexToRgb (hex) {
  let r = 0
  let g = 0
  let b = 0
  if (hex.length === 7) {
    r = parseInt('0x' + hex.slice(1, 3)) / 255
    g = parseInt('0x' + hex.slice(3, 5)) / 255
    b = parseInt('0x' + hex.slice(5, 7)) / 255
  }
  return [r, g, b]
}

function rgbToHex (r, g, b) {
  if (Array.isArray(r)) {
    g = r[1]
    b = r[2]
    r = r[0]
  }
  let s = '#' +
  Number(0x1000000 + r * 255 * 0x10000 + g * 255 * 0x100 + b * 255).toString(16).substring(1, 7)
  return s
}

function gear (params) {
  params = Object.assign({}, {numTeeth: 10, circularPitch: 5, pressureAngle: 20, clearance: 0, thickness: 5, centerholeradius: 2}, params)
  let gear = involuteGear(
    params.numTeeth,
    params.circularPitch,
    params.pressureAngle,
    params.clearance,
    params.thickness
  )
  if (params.centerholeradius > 0) {
    let centerhole = CSG.cylinder({start: [0, 0, -params.thickness], end: [0, 0, params.thickness], radius: params.centerholeradius, resolution: 16})
    gear = gear.subtract(centerhole)
  }
  return gear
}

/*
  For gear terminology see:
    http://www.astronomiainumbria.org/advanced_internet_files/meccanica/easyweb.easynet.co.uk/_chrish/geardata.htm
  Algorithm based on:
    http://www.cartertools.com/involute.html

  circularPitch: The distance between adjacent teeth measured at the pitch circle
*/
function involuteGear (numTeeth, circularPitch, pressureAngle, clearance, thickness) {
  // default values:
  if (arguments.length < 3) pressureAngle = 20
  if (arguments.length < 4) clearance = 0
  if (arguments.length < 4) thickness = 1

  let addendum = circularPitch / Math.PI
  let dedendum = addendum + clearance

  // radiuses of the 4 circles:
  let pitchRadius = numTeeth * circularPitch / (2 * Math.PI)
  let baseRadius = pitchRadius * Math.cos(Math.PI * pressureAngle / 180)
  let outerRadius = pitchRadius + addendum
  let rootRadius = pitchRadius - dedendum

  let maxtanlength = Math.sqrt(outerRadius * outerRadius - baseRadius * baseRadius)
  let maxangle = maxtanlength / baseRadius

  let tl_at_pitchcircle = Math.sqrt(pitchRadius * pitchRadius - baseRadius * baseRadius)
  let angle_at_pitchcircle = tl_at_pitchcircle / baseRadius
  let diffangle = angle_at_pitchcircle - Math.atan(angle_at_pitchcircle)
  let angularToothWidthAtBase = Math.PI / numTeeth + 2 * diffangle

  // build a single 2d tooth in the 'points' array:
  let resolution = 5
  let points = [new CSG.Vector2D(0, 0)]
  for (let i = 0; i <= resolution; i++) {
    // first side of the tooth:
    let angle = maxangle * i / resolution
    let tanlength = angle * baseRadius
    let radvector = CSG.Vector2D.fromAngle(angle)
    let tanvector = radvector.normal()
    let p = radvector.times(baseRadius).plus(tanvector.times(tanlength))
    points[i + 1] = p

    // opposite side of the tooth:
    radvector = CSG.Vector2D.fromAngle(angularToothWidthAtBase - angle)
    tanvector = radvector.normal().negated()
    p = radvector.times(baseRadius).plus(tanvector.times(tanlength))
    points[2 * resolution + 2 - i] = p
  }

  // create the polygon and extrude into 3D:
  const foo = CAG.fromPoints(points)
  let tooth3d = foo.extrude({offset: [0, 0, thickness]})

  let allteeth = new CSG()
  for (let j = 0; j < numTeeth; j++) {
    let ang = j * 360 / numTeeth
    let rotatedtooth = tooth3d.rotateZ(ang)
    allteeth = allteeth.unionForNonIntersecting(rotatedtooth)
  }

  // build the root circle:
  points = []
  let toothAngle = 2 * Math.PI / numTeeth
  let toothCenterAngle = 0.5 * angularToothWidthAtBase
  for (let k = 0; k < numTeeth; k++) {
    let angl = toothCenterAngle + k * toothAngle
    let p1 = CSG.Vector2D.fromAngle(angl).times(rootRadius)
    points.push(p1)
  }

  // create the polygon and extrude into 3D:
  let rootcircle = CAG.fromPoints(points).extrude({offset: [0, 0, thickness]})

  let result = rootcircle.union(allteeth)

  // center at origin:
  result = result.translate([0, 0, -thickness / 2])

  return result
}
