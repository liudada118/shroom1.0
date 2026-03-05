import { Vector2 } from 'three';

class SelectionHelper {



	constructor(renderer, controls, cssClassName) {

		this.element = document.createElement('div');
		this.element.classList.add(cssClassName);
		this.element.style.pointerEvents = 'none';

		this.renderer = renderer;
		this.controls = controls;
		this.startPoint = new Vector2();
		this.pointTopLeft = new Vector2();
		this.pointBottomRight = new Vector2();
		this.isShiftPressed = false;
		this.isDown = false;
		this.isKey = false;
		this.shiftFlag = 0
		this.elementDownFlag = false
		this.pointStart = new Vector2();

		this.onPointerDown = function (event) {

			this.isDown = true;
			if (!this.isKey) {
				this.onSelectStart(event);
			} else {
				this.setStartPoint(event)
			}


		}.bind(this);

		this.onPointerMove = function (event) {
			if(this.isShiftPressed){
				if (this.isDown ) {
					this.onSelectMove(event);
	
				}
			}
			

		}.bind(this);

		this.onPointerUp = function () {

			this.isDown = false;
			// this.onSelectOver();

		}.bind(this);


	



		this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
		this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
		this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);


	

		document.addEventListener('keyup', (e) => {
			// console.log(e)
			// this.shiftFlag = 0
			// if (e.key === 'Shift') {
			// 	this.isKey = false
			// }
		})
	}

	dispose() {

		this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
		this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
		this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);

	}

	onSelectStart(event) {
		console.log(11111)
		if (this.isShiftPressed) {
			// this.element.style.display = 'none';

			this.renderer.domElement.parentElement.appendChild(this.element);

			this.element.style.left = event.clientX + 'px';
			this.element.style.top = event.clientY + 'px';
			this.element.style.width = '0px';
			this.element.style.height = '0px';

			this.startPoint.x = event.clientX;
			this.startPoint.y = event.clientY;
		}
	}

	// elementMove(event) {
	// 	console.log(parseInt(this.element.style.left) , this.element.style.left , event.clientX , this.pointStart)
	// 	this.element.style.left = parseInt(this.element.style.left) + (event.clientX - this.pointStart.x) +'px' ;
	// 	this.element.style.top = parseInt(this.element.style.top) + (event.clientY - this.pointStart.y)  + 'px';
	// }

	// setStartPoint(event) {
	// 	this.pointStart.x = event.clientX;
	// 	this.pointStart.y = event.clientY;
	// }

	onSelectMove(event) {

		// 按下shift键

			this.element.style.display = 'block';

			this.pointBottomRight.x = Math.max(this.startPoint.x, event.clientX);
			this.pointBottomRight.y = Math.max(this.startPoint.y, event.clientY);
			this.pointTopLeft.x = Math.min(this.startPoint.x, event.clientX);
			this.pointTopLeft.y = Math.min(this.startPoint.y, event.clientY);

			this.element.style.left = this.pointTopLeft.x + 'px';
			this.element.style.top = this.pointTopLeft.y + 'px';
			this.element.style.width = (this.pointBottomRight.x - this.pointTopLeft.x) + 'px';
			this.element.style.height = (this.pointBottomRight.y - this.pointTopLeft.y) + 'px';
	

	}

	onSelectOver() {
		if (this.element) {
			this.element.parentElement?.removeChild(this.element);
		}


	}

}

export { SelectionHelper };