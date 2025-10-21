import { FIELD_SIZE, PHYSICS } from '../constants.js';

export class PhysicsWorld{
  constructor(RAPIER){
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x:0, y:PHYSICS.gravity, z:0 });
  }
  step(){ this.world.timestep = 1/60; this.world.step(); }

  addGround(){
    const R = this.RAPIER;
    const rb = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    const c  = R.ColliderDesc.cuboid(FIELD_SIZE.w/2, 0.1, FIELD_SIZE.h/2)
                 .setRestitution(PHYSICS.restitution)
                 .setFriction(PHYSICS.friction)
                 .setTranslation(0, 0, 0);
    this.world.createCollider(c, rb);
  }
  addBallBody(radius, position){
    const R = this.RAPIER;
    const rb = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
       .setTranslation(position.x, position.y, position.z)
       .setLinearDamping(PHYSICS.linDamp)
       .setAngularDamping(PHYSICS.angDamp)
    );
    const col = R.ColliderDesc.ball(radius)
      .setRestitution(PHYSICS.restitution)
      .setFriction(PHYSICS.friction);
    this.world.createCollider(col, rb);
    return rb;
  }
  addBoxWall(pos, half){
    const R = this.RAPIER;
    const rb = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(pos.x,pos.y,pos.z));
    const col = R.ColliderDesc.cuboid(half.hx, half.hy, half.hz);
    this.world.createCollider(col, rb);
    return rb;
  }
}