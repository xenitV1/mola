// Loopback remains the default. Only isolated container deployments opt in to all interfaces.
export function billingListenOptions(env=process.env){
 const host=env.CAFE_BILLING_HOST??'127.0.0.1';
 if(!['127.0.0.1','0.0.0.0'].includes(host))throw Error('invalid_CAFE_BILLING_HOST');
 const rawPort=env.CAFE_BILLING_PORT??'37326';
 if(!/^\d+$/.test(rawPort))throw Error('invalid_CAFE_BILLING_PORT');
 const port=Number(rawPort);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid_CAFE_BILLING_PORT');
 return {host,port};
}
